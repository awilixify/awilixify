import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, extname, resolve } from "node:path";

type JsonObject = Record<string, unknown>;

type AsyncApiDocument = {
	channels?: Record<string, JsonObject>;
	operations?: Record<string, JsonObject>;
};

type AmqpExchange = {
	autoDelete?: boolean;
	durable?: boolean;
	name: string;
	type?: string;
};

type AsyncApiPublisherOperation = {
	address: string;
	exchange: AmqpExchange;
	messageType: string;
	operationId: string;
	payload?: JsonObject;
	payloadTypeName?: string;
};

export type GenerateAsyncApiClientModuleOptions = {
	clientImport: string;
	clientProviderName: string;
	messagesImport: string;
	moduleName: string;
	outputPath: string;
};

export type GenerateAsyncApiClientOptions = {
	asyncApi: string | AsyncApiDocument;
	clientClassName: string;
	messagesConstName: string;
	outputDirectory: string;
	runtimeImport: string;
	serviceName: string;
	include?: readonly string[];
	clientFileName?: string;
	messagesFileName?: string;
	module?: GenerateAsyncApiClientModuleOptions;
};

export type GenerateAsyncApiClientResult = {
	clientPath: string;
	messagesPath: string;
	moduleCreated?: boolean;
	modulePath?: string;
	operationIds: string[];
};

export type GenerateAsyncApiConsumerModuleOptions = {
	messagesImport: string;
	moduleName: string;
	outputPath: string;
};

export type GenerateAsyncApiConsumerOptions = {
	asyncApi: string | AsyncApiDocument;
	messagesConstName: string;
	outputDirectory: string;
	runtimeImport: string;
	serviceName: string;
	include?: readonly string[];
	messagesFileName?: string;
	module?: GenerateAsyncApiConsumerModuleOptions;
};

export type GenerateAsyncApiConsumerResult = {
	messagesPath: string;
	moduleCreated?: boolean;
	modulePath?: string;
	operationIds: string[];
};

export async function generateAsyncApiClient(
	options: GenerateAsyncApiClientOptions,
): Promise<GenerateAsyncApiClientResult> {
	assertIdentifier(options.clientClassName, "client class name");
	assertIdentifier(options.messagesConstName, "messages constant name");

	const document = await resolveDocument(options.asyncApi);
	const operations = collectOperations(document, options.include, "receive");
	const outputDirectory = resolve(options.outputDirectory);
	const clientFileName = options.clientFileName ?? "asyncapi-client.ts";
	const messagesFileName = options.messagesFileName ?? "asyncapi.messages.ts";
	const clientPath = resolve(outputDirectory, clientFileName);
	const messagesPath = resolve(outputDirectory, messagesFileName);
	const modulePath = options.module
		? resolve(options.module.outputPath)
		: undefined;

	await mkdir(outputDirectory, { recursive: true });
	const messagesSource = await renderMessages(options, operations, document);
	await Promise.all([
		replaceFile(
			clientPath,
			renderClient(options, operations, toJavaScriptImport(messagesFileName)),
		),
		replaceFile(messagesPath, messagesSource),
	]);

	const moduleCreated =
		modulePath && options.module
			? await createFileIfMissing(
					modulePath,
					renderModule(options, options.module),
				)
			: undefined;

	return {
		clientPath,
		messagesPath,
		moduleCreated,
		modulePath,
		operationIds: operations.map((operation) => operation.operationId),
	};
}

export async function generateAsyncApiConsumer(
	options: GenerateAsyncApiConsumerOptions,
): Promise<GenerateAsyncApiConsumerResult> {
	assertIdentifier(options.messagesConstName, "messages constant name");

	const document = await resolveDocument(options.asyncApi);
	const operations = collectOperations(document, options.include, "send");
	const outputDirectory = resolve(options.outputDirectory);
	const messagesFileName = options.messagesFileName ?? "asyncapi.events.ts";
	const messagesPath = resolve(outputDirectory, messagesFileName);
	const modulePath = options.module
		? resolve(options.module.outputPath)
		: undefined;

	await mkdir(outputDirectory, { recursive: true });
	await replaceFile(
		messagesPath,
		await renderMessages(options, operations, document),
	);

	const moduleCreated =
		modulePath && options.module
			? await createFileIfMissing(
					modulePath,
					renderConsumerModule(options, options.module),
				)
			: undefined;

	return {
		messagesPath,
		moduleCreated,
		modulePath,
		operationIds: operations.map((operation) => operation.operationId),
	};
}

async function resolveDocument(
	input: string | AsyncApiDocument,
): Promise<AsyncApiDocument> {
	if (typeof input !== "string") return input;

	const response = await fetch(input);
	if (!response.ok) {
		throw new Error(
			`Failed to fetch AsyncAPI document from ${input}: ${response.status} ${response.statusText}`,
		);
	}

	return (await response.json()) as AsyncApiDocument;
}

function collectOperations(
	document: AsyncApiDocument,
	include: readonly string[] | undefined,
	action: "receive" | "send",
): AsyncApiPublisherOperation[] {
	const selected = new Set(include);
	const operations: AsyncApiPublisherOperation[] = [];

	for (const [operationId, operation] of Object.entries(
		document.operations ?? {},
	)) {
		if (operation.action !== action) continue;
		if (selected.size && !selected.has(operationId)) continue;
		assertIdentifier(operationId, "AsyncAPI operation ID");

		const channel = resolveReference(document, operation.channel, "channel");
		const messages = Array.isArray(operation.messages)
			? operation.messages
			: [];
		const message = resolveReference(document, messages[0], "message");
		const address = requireString(
			channel.address,
			`${operationId} channel address`,
		);
		const payload =
			message.payload === undefined
				? undefined
				: requireObject(message.payload, `${operationId} message payload`);
		const bindings = requireObject(
			channel.bindings,
			`${operationId} channel bindings`,
		);
		const amqp = requireObject(bindings.amqp, `${operationId} AMQP binding`);
		const exchangeValue = requireObject(
			amqp.exchange,
			`${operationId} AMQP exchange`,
		);

		operations.push({
			address,
			exchange: {
				autoDelete: optionalBoolean(exchangeValue.autoDelete),
				durable: optionalBoolean(exchangeValue.durable),
				name: requireString(exchangeValue.name, `${operationId} exchange name`),
				type:
					typeof exchangeValue.type === "string"
						? exchangeValue.type
						: undefined,
			},
			messageType:
				typeof message["x-awilixify-type"] === "string"
					? message["x-awilixify-type"]
					: requireString(message.name, `${operationId} message type`),
			operationId,
			payload,
			payloadTypeName: payload
				? `${toPascalCase(operationId)}Payload`
				: undefined,
		});
	}

	if (selected.size) {
		const found = new Set(operations.map((operation) => operation.operationId));
		const missing = [...selected].filter(
			(operationId) => !found.has(operationId),
		);
		if (missing.length) {
			throw new Error(
				`AsyncAPI ${action} operations not found: ${missing.join(", ")}`,
			);
		}
	}

	if (!operations.length) {
		throw new Error(`No AsyncAPI ${action} operations selected for generation`);
	}

	return operations;
}

function resolveReference(
	document: AsyncApiDocument,
	value: unknown,
	label: string,
): JsonObject {
	const object = requireObject(value, label);
	if (typeof object.$ref !== "string") return object;

	if (!object.$ref.startsWith("#/")) {
		throw new Error(
			`Only local AsyncAPI references are supported: ${object.$ref}`,
		);
	}

	let current: unknown = document;
	for (const encodedPart of object.$ref.slice(2).split("/")) {
		const part = encodedPart.replaceAll("~1", "/").replaceAll("~0", "~");
		current = requireObject(current, object.$ref)[part];
	}

	return requireObject(current, object.$ref);
}

async function renderMessages(
	options: Pick<
		GenerateAsyncApiClientOptions,
		"messagesConstName" | "runtimeImport" | "serviceName"
	>,
	operations: readonly AsyncApiPublisherOperation[],
	document: AsyncApiDocument,
): Promise<string> {
	const payloadModels = await renderPayloadModels(operations, document);
	const entries = operations
		.map(
			(
				operation,
			) => `\t${operation.operationId}: defineRabbitMessage${operation.payloadTypeName ? `<${operation.payloadTypeName}>` : ""}({
\t\texchange: ${indent(renderExchange(operation.exchange), 2)},
\t\troutingKey: ${JSON.stringify(operation.address)},
\t\tserviceName: ${JSON.stringify(options.serviceName)},
\t\ttype: ${JSON.stringify(operation.messageType)},
\t}),`,
		)
		.join("\n");

	return `// Generated from AsyncAPI. Do not edit.
import { defineRabbitMessage } from ${JSON.stringify(options.runtimeImport)};

${payloadModels}

export const ${options.messagesConstName} = {
${entries}
} as const;
`;
}

async function renderPayloadModels(
	operations: readonly AsyncApiPublisherOperation[],
	document: AsyncApiDocument,
): Promise<string> {
	if (!operations.some((operation) => operation.payload)) return "";

	let TypeScriptGenerator: typeof import("@asyncapi/modelina").TypeScriptGenerator;
	try {
		({ TypeScriptGenerator } = await import("@asyncapi/modelina"));
	} catch (error) {
		throw new Error(
			'AsyncAPI codegen requires the optional peer dependency "@asyncapi/modelina"',
			{ cause: error },
		);
	}

	const rendered: string[] = [];
	for (const operation of operations) {
		if (!operation.payload || !operation.payloadTypeName) continue;
		const operationPrefix = toPascalCase(operation.operationId);
		const generator = new TypeScriptGenerator({
			modelType: "interface",
			processorOptions: {
				jsonSchema: { ignoreAdditionalProperties: true },
			},
			constraints: {
				modelName: ({ modelName }) => {
					const constrainedName = toPascalCase(modelName);
					return constrainedName === operation.payloadTypeName
						? constrainedName
						: `${operationPrefix}${constrainedName}`;
				},
			},
		});
		const models = await generator.generate({
			...requireObject(
				resolveSchemaReferences(operation.payload, document),
				`${operation.operationId} resolved payload`,
			),
			$id: operation.payloadTypeName,
		});

		rendered.push(...models.map((model) => `export ${model.result}`));
	}

	return rendered.join("\n\n");
}

function renderClient(
	options: GenerateAsyncApiClientOptions,
	operations: readonly AsyncApiPublisherOperation[],
	messagesImport: string,
): string {
	const methods = operations
		.map((operation) =>
			operation.payloadTypeName
				? `\t@callsOperation(${options.messagesConstName}.${operation.operationId})
\t${operation.operationId}(
\t\tpayload: MessagePayload<typeof ${options.messagesConstName}.${operation.operationId}>,
\t): Promise<void> {
\t\treturn this.rabbitPublisher.publish({
\t\t\tmessage: this.rabbitPublisher.messages.${operation.operationId},
\t\t\tpayload,
\t\t});
\t}`
				: `\t@callsOperation(${options.messagesConstName}.${operation.operationId})
\t${operation.operationId}(): Promise<void> {
\t\treturn this.rabbitPublisher.publish({
\t\t\tmessage: this.rabbitPublisher.messages.${operation.operationId},
\t\t});
\t}`,
		)
		.join("\n\n");

	return `// Generated from AsyncAPI. Do not edit.

import type { MessagePayload, RabbitPublisher } from ${JSON.stringify(options.runtimeImport)};
import { callsOperation } from "awilixify";

import { ${options.messagesConstName} } from ${JSON.stringify(messagesImport)};

export class ${options.clientClassName} {
\tconstructor(
\t\tprivate readonly rabbitPublisher: RabbitPublisher<typeof ${options.messagesConstName}>,
\t) {}

${methods}
}
`;
}

function renderModule(
	options: GenerateAsyncApiClientOptions,
	module: GenerateAsyncApiClientModuleOptions,
): string {
	assertIdentifier(module.moduleName, "module name");
	assertIdentifier(module.clientProviderName, "client provider name");
	const moduleDefName = `${module.moduleName}Def`;
	const rabbitMqModuleName = `${module.moduleName.replace(/Module$/, "")}RabbitMqModule`;
	assertIdentifier(rabbitMqModuleName, "RabbitMQ module name");

	return `// Generated once by Awilixify codegen. Safe to customize.
import { RabbitMqModule } from ${JSON.stringify(options.runtimeImport)};
import { createModule, type ModuleDef } from "awilixify";

import { ${options.clientClassName} } from ${JSON.stringify(module.clientImport)};
import { ${options.messagesConstName} } from ${JSON.stringify(module.messagesImport)};

const ${rabbitMqModuleName} = RabbitMqModule({
\tpublisher: ${options.messagesConstName},
});

export type ${moduleDefName} = ModuleDef<{
\texportKeys: [${JSON.stringify(module.clientProviderName)}];
\timports: [typeof ${rabbitMqModuleName}];
\tproviders: {
\t\t${module.clientProviderName}: ${options.clientClassName};
\t};
}>;

export type Deps = ${moduleDefName}["deps"];

export const ${module.moduleName} = createModule<${moduleDefName}>({
\tname: ${JSON.stringify(module.moduleName)},
\timports: [${rabbitMqModuleName}],
\tproviders: {
\t\t${module.clientProviderName}: ${options.clientClassName},
\t},
\texports: [${JSON.stringify(module.clientProviderName)}],
});
`;
}

function renderConsumerModule(
	options: GenerateAsyncApiConsumerOptions,
	module: GenerateAsyncApiConsumerModuleOptions,
): string {
	assertIdentifier(module.moduleName, "module name");

	return `// Generated once by Awilixify codegen. Safe to customize.
import { RabbitMqModule } from ${JSON.stringify(options.runtimeImport)};

import { ${options.messagesConstName} } from ${JSON.stringify(module.messagesImport)};

export const ${module.moduleName} = RabbitMqModule({
	consumer: Object.values(${options.messagesConstName}),
});
`;
}

function renderExchange(exchange: AmqpExchange): string {
	return JSON.stringify(
		{
			name: exchange.name,
			options: {
				autoDelete: exchange.autoDelete ?? false,
				durable: exchange.durable ?? true,
			},
			type: exchange.type ?? "topic",
		},
		null,
		"\t",
	);
}

function indent(value: string, depth: number): string {
	const prefix = "\t".repeat(depth);

	return value.replaceAll("\n", `\n${prefix}`);
}

function resolveSchemaReferences(
	value: unknown,
	document: AsyncApiDocument,
): unknown {
	if (Array.isArray(value)) {
		return value.map((item) => resolveSchemaReferences(item, document));
	}
	if (!value || typeof value !== "object") return value;

	const object = value as JsonObject;
	if (typeof object.$ref === "string") {
		return resolveSchemaReferences(
			resolveReference(document, object, "schema"),
			document,
		);
	}

	return Object.fromEntries(
		Object.entries(object).map(([key, item]) => [
			key,
			resolveSchemaReferences(item, document),
		]),
	);
}

async function replaceFile(filePath: string, source: string): Promise<void> {
	const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
	try {
		await writeFile(temporaryPath, source);
		await rename(temporaryPath, filePath);
	} finally {
		await rm(temporaryPath, { force: true });
	}
}

async function createFileIfMissing(
	filePath: string,
	source: string,
): Promise<boolean> {
	await mkdir(dirname(filePath), { recursive: true });
	try {
		await writeFile(filePath, source, { flag: "wx" });
		return true;
	} catch (error) {
		if (
			typeof error === "object" &&
			error !== null &&
			"code" in error &&
			error.code === "EEXIST"
		) {
			return false;
		}
		throw error;
	}
}

function requireObject(value: unknown, label: string): JsonObject {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(`${label} must be an object`);
	}
	return value as JsonObject;
}

function requireString(value: unknown, label: string): string {
	if (typeof value !== "string" || !value) {
		throw new Error(`${label} must be a non-empty string`);
	}
	return value;
}

function optionalBoolean(value: unknown): boolean | undefined {
	return typeof value === "boolean" ? value : undefined;
}

function assertIdentifier(value: string, label: string): void {
	if (!/^[$A-Z_a-z][$\w]*$/.test(value)) {
		throw new Error(`${label} "${value}" is not a valid TypeScript identifier`);
	}
}

function toPascalCase(value: string): string {
	const result = value
		.replaceAll(/([a-z\d])([A-Z])/g, "$1 $2")
		.split(/[^A-Za-z\d]+/)
		.filter(Boolean)
		.map((part) => `${part[0]?.toUpperCase()}${part.slice(1)}`)
		.join("");

	return result || "Payload";
}

function toJavaScriptImport(fileName: string): string {
	return `./${basename(fileName, extname(fileName))}.js`;
}
