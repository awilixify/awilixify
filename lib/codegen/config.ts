import type {
	GenerateAsyncApiClientOptions,
	GenerateAsyncApiConsumerOptions,
} from "./generate-asyncapi-client.js";
import type { GenerateOrvalApiClientOptions } from "./generate-orval-api-client.js";

export type AwilixifyCodegenConfig = {
	asyncApiClients?: GenerateAsyncApiClientOptions[];
	asyncApiConsumers?: GenerateAsyncApiConsumerOptions[];
	clients?: GenerateOrvalApiClientOptions[];
};

export function defineCodegenConfig(
	config: AwilixifyCodegenConfig,
): AwilixifyCodegenConfig {
	return config;
}
