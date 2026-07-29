#!/usr/bin/env node

import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { AwilixifyCodegenConfig } from "./config.js";
import {
	generateAsyncApiClient,
	generateAsyncApiConsumer,
} from "./generate-asyncapi-client.js";
import { generateOrvalApiClient } from "./generate-orval-api-client.js";

const [, , command, ...args] = process.argv;

if (command !== "codegen") {
	throw new Error(
		"Usage: awilixify codegen --config <path-to-codegen-config.mjs>",
	);
}

const configArgumentIndex = args.indexOf("--config");
const configPath = args[configArgumentIndex + 1];

if (configArgumentIndex === -1 || !configPath) {
	throw new Error("The codegen command requires --config");
}

const resolvedConfigPath = resolve(configPath);
const configDirectory = dirname(resolvedConfigPath);
const configModule = (await import(pathToFileURL(resolvedConfigPath).href)) as {
	default?: AwilixifyCodegenConfig;
};
const config = configModule.default;

if (!config) {
	throw new Error("Codegen config must default-export a configuration object");
}

for (const client of config.clients ?? []) {
	await generateOrvalApiClient({
		...client,
		outputDirectory: resolve(configDirectory, client.outputDirectory),
		module: client.module
			? {
					...client.module,
					outputPath: resolve(configDirectory, client.module.outputPath),
				}
			: undefined,
	});
}

for (const client of config.asyncApiClients ?? []) {
	await generateAsyncApiClient({
		...client,
		outputDirectory: resolve(configDirectory, client.outputDirectory),
		module: client.module
			? {
					...client.module,
					outputPath: resolve(configDirectory, client.module.outputPath),
				}
			: undefined,
	});
}

for (const consumer of config.asyncApiConsumers ?? []) {
	await generateAsyncApiConsumer({
		...consumer,
		outputDirectory: resolve(configDirectory, consumer.outputDirectory),
		module: consumer.module
			? {
					...consumer.module,
					outputPath: resolve(configDirectory, consumer.module.outputPath),
				}
			: undefined,
	});
}
