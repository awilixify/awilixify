import { createModule, type ModuleDef } from "awilixify";
import { BentoCache, BentoStore, bentostore } from "bentocache";
import { redisDriver } from "bentocache/drivers/redis";

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
	createModule<CacheModuleDef>({
		name: "CacheModule",
		imports: [BentoCacheModule],
		providers: {
			namespace,
		},
		interceptors: {
			cache: CacheInterceptor,
		},
		interceptorExports: ["cache"],
	});

type BentoCacheModuleDef = ModuleDef<{
	providers: {
		bentoCache: BentoCache<{ redis: BentoStore }>;
	};
	exportKeys: ["bentoCache"];
}>;

const BentoCacheModule = createModule<BentoCacheModuleDef>({
	name: "BentoCacheModule",
	exports: ["bentoCache"],
	providers: {
		bentoCache: {
			provide: BentoCache,
			useFactory: () =>
				new BentoCache({
					default: "redis",
					stores: {
						redis: bentostore().useL2Layer(
							redisDriver({
								connection: { host: "127.0.0.1", port: 6380 },
							}),
						),
					},
				}),
		},
	},
});
