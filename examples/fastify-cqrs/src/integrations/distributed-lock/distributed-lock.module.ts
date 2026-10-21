import { createFactoryProvider, createModule, type ModuleDef } from "awilixify";
import { RedisDriver } from "bentocache/drivers/redis";

import { DistributedLockInterceptor } from "./distributed-lock.interceptor.js";

type DistributedLockModuleDef = ModuleDef<{
	providers: {
		redis: ReturnType<RedisDriver["getConnection"]>;
	};
	interceptors: {
		distributedLockInterceptor: DistributedLockInterceptor;
	};
	exportInterceptorKeys: ["distributedLockInterceptor"];
}>;

export type Deps = DistributedLockModuleDef["deps"];

const factory = createFactoryProvider<DistributedLockModuleDef>();

export const DistributedLockModule = createModule<DistributedLockModuleDef>({
	name: "DistributedLockModule",
	providers: {
		redis: factory({
			inject: ["config"],
			useFactory: (config) =>
				new RedisDriver({
					connection: {
						host: config.get("redisHost"),
						port: config.get("redisPort"),
						// Surface outages instead of keeping lock commands queued indefinitely.
						enableOfflineQueue: false,
						maxRetriesPerRequest: 0,
						commandTimeout: 1_000,
					},
				}).getConnection(),
		}),
	},
	interceptors: {
		distributedLockInterceptor: DistributedLockInterceptor,
	},
	interceptorExports: ["distributedLockInterceptor"],
});
