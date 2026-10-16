import { createModule, type ModuleDef, createFactoryProvider } from "awilixify";
import { BentoCache, BentoStore, bentostore } from "bentocache";
import { RedisDriver, redisDriver } from "bentocache/drivers/redis";

import { CacheInterceptor } from "./cache.interceptor.js";

type CacheModuleDef = ModuleDef<{
	interceptors: {
		cache: CacheInterceptor;
	};
	providers: {
		namespace: string;
	};
	imports: [typeof BentoCacheModule];
	exportInterceptorKeys: ["cache"];
}>;

export type Deps = CacheModuleDef["deps"];

export const CacheModule = (namespace: string) =>
	createModule<CacheModuleDef>(
		{
			name: "CacheModule",
			imports: [BentoCacheModule],
			providers: {
				namespace,
			},
			interceptors: {
				cache: CacheInterceptor,
			},
			interceptorExports: ["cache"],
		},
		{ hashNameFrom: namespace },
	);

type BentoCacheModuleDef = ModuleDef<{
	providers: {
		bentoCache: BentoCache<{ redis: BentoStore }>;
		cacheRedisDriver: RedisDriver;
	};
	exportKeys: ["bentoCache", "cacheRedisDriver"];
}>;

const factory = createFactoryProvider<BentoCacheModuleDef>();

const BentoCacheModule = createModule<BentoCacheModuleDef>({
	name: "BentoCacheModule",
	exports: ["bentoCache", "cacheRedisDriver"],
	providers: {
		cacheRedisDriver: factory({
			inject: ["config"],
			useFactory: (c) =>
				new RedisDriver({
					connection: {
						host: c.get("redisHost"),
						port: c.get("redisPort"),
					},
				}),
		}),
		bentoCache: factory({
			inject: ["cacheRedisDriver"],
			useFactory: (driver) =>
				new BentoCache({
					default: "redis",
					stores: {
						redis: bentostore().useL2Layer(
							redisDriver({
								connection: driver.getConnection(),
							}),
						),
					},
				}),
		}),
	},
});
