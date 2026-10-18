import { createFactoryProvider, createModule, type ModuleDef } from "awilixify";
import { RedisDriver } from "bentocache/drivers/redis";

import { IdempotencyInterceptor } from "./idempotency.interceptor.js";

type IdempotencyModuleDef = ModuleDef<{
	providers: {
		idempotencyRedisDriver: RedisDriver;
	};
	interceptors: {
		idempotencyInterceptor: IdempotencyInterceptor;
	};
	exportInterceptorKeys: ["idempotencyInterceptor"];
}>;

export type Deps = IdempotencyModuleDef["deps"];

const factory = createFactoryProvider<IdempotencyModuleDef>();

export const IdempotencyModule = createModule<IdempotencyModuleDef>({
	name: "IdempotencyModule",
	providers: {
		idempotencyRedisDriver: factory({
			inject: ["config"],
			useFactory: (config) =>
				new RedisDriver({
					connection: {
						host: config.get("redisHost"),
						port: config.get("redisPort"),
						// Surface outages instead of keeping idempotency commands queued indefinitely.
						enableOfflineQueue: false,
						maxRetriesPerRequest: 0,
						commandTimeout: 1_000,
					},
				}),
		}),
	},
	interceptors: {
		idempotencyInterceptor: IdempotencyInterceptor,
	},
	interceptorExports: ["idempotencyInterceptor"],
});
