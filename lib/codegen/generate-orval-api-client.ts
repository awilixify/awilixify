import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, extname, resolve } from "node:path";

type OpenApiOperation = {
	operationId?: unknown;
	tags?: unknown;
};

type OpenApiDocument = {
	paths?: Record<string, Record<string, OpenApiOperation>>;
};

export type GenerateApiClientModuleOptions = {
	outputPath: string;
	moduleName: string;
	apiClientProviderName: string;
	apiClientImport: string;
	exports?: readonly string[];
};

export type GenerateOrvalApiClientOptions = {
	serviceName: string;
	openApi: string | OpenApiDocument;
	outputDirectory: string;
	generatedClientImport: string;
	apiClientClassName: string;
	operationsConstName: string;
	tags?: readonly string[];
	apiClientFileName?: string;
	operationsFileName?: string;
	getOperationFunctionName?: (operationId: string) => string;
	module?: GenerateApiClientModuleOptions;
};

export type GenerateOrvalApiClientResult = {
	operationIds: string[];
	apiClientPath: string;
	operationsPath: string;
	modulePath?: string;
	moduleCreated?: boolean;
};

const httpMethods = new Set([
	"delete",
	"get",
	"head",
	"options",
	"patch",
	"post",
	"put",
	"trace",
]);

export async function generateOrvalApiClient(
	options: GenerateOrvalApiClientOptions,
): Promise<GenerateOrvalApiClientResult> {
	const document = await resolveOpenApiDocument(options.openApi);
	const operationIds = collectOperationIds(document, options.tags);
	const getOperationFunctionName =
		options.getOperationFunctionName ?? ((operationId) => operationId);

	assertIdentifier(options.apiClientClassName, "API client class name");
	assertIdentifier(options.operationsConstName, "operations constant name");

	const operations = operationIds.map((operationId) => {
		assertIdentifier(operationId, "operation ID");

		const functionName = getOperationFunctionName(operationId);
		assertIdentifier(
			functionName,
			`function name for operation "${operationId}"`,
		);

		return { functionName, operationId };
	});

	const apiClientFileName =
		options.apiClientFileName ?? "generated-api-client.ts";
	const operationsFileName =
		options.operationsFileName ?? "generated.operations.ts";
	const outputDirectory = resolve(options.outputDirectory);
	const apiClientPath = resolve(outputDirectory, apiClientFileName);
	const operationsPath = resolve(outputDirectory, operationsFileName);
	const moduleOptions = options.module;
	const modulePath = moduleOptions
		? resolve(moduleOptions.outputPath)
		: undefined;

	await mkdir(outputDirectory, { recursive: true });
	await Promise.all([
		replaceFile(
			apiClientPath,
			renderApiClient({
				...options,
				operations,
				operationsImport: toJavaScriptImport(operationsFileName),
			}),
		),
		replaceFile(
			operationsPath,
			renderOperations(
				options.serviceName,
				options.operationsConstName,
				operationIds,
			),
		),
	]);

	const moduleCreated =
		moduleOptions && modulePath
			? await createModuleIfMissing(
					modulePath,
					renderModule(options.apiClientClassName, moduleOptions),
				)
			: undefined;

	return {
		operationIds,
		apiClientPath,
		operationsPath,
		modulePath,
		moduleCreated,
	};
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

async function createModuleIfMissing(
	modulePath: string,
	source: string,
): Promise<boolean> {
	await mkdir(dirname(modulePath), { recursive: true });

	try {
		await writeFile(modulePath, source, { flag: "wx" });
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

async function resolveOpenApiDocument(
	input: string | OpenApiDocument,
): Promise<OpenApiDocument> {
	if (typeof input !== "string") return input;

	const response = await fetch(input);
	if (!response.ok) {
		throw new Error(
			`Failed to fetch OpenAPI document from ${input}: ${response.status} ${response.statusText}`,
		);
	}

	return (await response.json()) as OpenApiDocument;
}

function collectOperationIds(
	document: OpenApiDocument,
	tags: readonly string[] | undefined,
): string[] {
	const operationIds = new Set<string>();

	for (const pathItem of Object.values(document.paths ?? {})) {
		for (const [method, operation] of Object.entries(pathItem)) {
			if (!httpMethods.has(method.toLowerCase())) continue;
			if (typeof operation.operationId !== "string") continue;
			const operationTags = Array.isArray(operation.tags)
				? operation.tags.filter((tag): tag is string => typeof tag === "string")
				: [];
			if (tags?.length && !tags.some((tag) => operationTags.includes(tag))) {
				continue;
			}

			operationIds.add(operation.operationId);
		}
	}

	return [...operationIds];
}

function renderApiClient({
	apiClientClassName,
	generatedClientImport,
	operations,
	operationsConstName,
	operationsImport,
}: GenerateOrvalApiClientOptions & {
	operations: Array<{ functionName: string; operationId: string }>;
	operationsImport: string;
}): string {
	const imports = operations
		.map(
			({ functionName, operationId }) =>
				`\t${functionName} as ${operationId}Request,`,
		)
		.join("\n");
	const methods = operations
		.map(
			({
				operationId,
			}) => `\t@callsOperation(${operationsConstName}.${operationId})
\t${operationId}(
\t\t...args: Parameters<typeof ${operationId}Request>
\t): ReturnType<typeof ${operationId}Request> {
\t\treturn ${operationId}Request(
\t\t\t...(withTracePropagation(args, ${operationId}Request.length - 1) as Parameters<
\t\t\t\ttypeof ${operationId}Request
\t\t\t>),
\t\t);
\t}`,
		)
		.join("\n\n");

	return `// Generated from OpenAPI. Do not edit.
import { callsOperation } from "awilixify";
import { getTracePropagationHeaders } from "awilixify/devtools";

import {
${imports}
} from ${JSON.stringify(generatedClientImport)};
import { ${operationsConstName} } from ${JSON.stringify(operationsImport)};

function withTracePropagation(args: unknown[], optionsIndex: number): unknown[] {
\tconst tracedArgs = [...args];
\tconst options = (tracedArgs[optionsIndex] ?? {}) as {
\t\theaders?: Record<string, string>;
\t};

\ttracedArgs[optionsIndex] = {
\t\t...options,
\t\theaders: {
\t\t\t...options.headers,
\t\t\t...getTracePropagationHeaders(),
\t\t},
\t};

\treturn tracedArgs;
}

export class ${apiClientClassName} {
${methods}
}
`;
}

function renderOperations(
	serviceName: string,
	operationsConstName: string,
	operationIds: readonly string[],
): string {
	const operations = Object.fromEntries(
		operationIds.map((operationId) => [
			operationId,
			{
				serviceName,
				operationId,
				transport: "http",
			},
		]),
	);

	return `// Generated from OpenAPI. Do not edit.
export const ${operationsConstName} = ${JSON.stringify(operations, null, 2)} as const;
`;
}

function renderModule(
	apiClientClassName: string,
	options: GenerateApiClientModuleOptions,
): string {
	assertIdentifier(options.moduleName, "module name");
	assertIdentifier(options.apiClientProviderName, "API client provider name");

	const exportNames = options.exports ?? [options.apiClientProviderName];
	for (const providerName of exportNames) {
		if (providerName !== options.apiClientProviderName) {
			throw new Error(
				`Initial module export "${providerName}" is not the generated API client provider`,
			);
		}
	}

	const imports = `import { createModule, type ModuleDef } from "awilixify";

import { ${apiClientClassName} } from ${JSON.stringify(options.apiClientImport)};`;
	const exportKeys = exportNames.map((name) => JSON.stringify(name)).join(", ");
	const moduleDefName = `${options.moduleName}Def`;

	return `// Generated once by Awilixify codegen. Safe to customize.
${imports}

export type ${moduleDefName} = ModuleDef<{
\tproviders: {
\t\t${options.apiClientProviderName}: ${apiClientClassName};
\t};
\texportKeys: [${exportKeys}];
}>;

export type Deps = ${moduleDefName}["deps"];

export const ${options.moduleName} = createModule<${moduleDefName}>({
\tname: "${options.moduleName}",
\tproviders: {
\t\t${options.apiClientProviderName}: ${apiClientClassName},
\t},
\texports: [${exportKeys}],
});
`;
}

function assertIdentifier(value: string, label: string): void {
	if (!/^[$A-Z_a-z][$\w]*$/.test(value)) {
		throw new Error(`${label} "${value}" is not a valid TypeScript identifier`);
	}
}

function toJavaScriptImport(fileName: string): string {
	return `./${basename(fileName, extname(fileName))}.js`;
}
