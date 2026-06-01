import { createModule, type ModuleDef, createFactoryProvider } from "awilixify";
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
	};
	exportKeys: ["bentoCache"];
}>;

const factory = createFactoryProvider<BentoCacheModuleDef>();

const BentoCacheModule = createModule<BentoCacheModuleDef>({
	name: "BentoCacheModule",
	exports: ["bentoCache"],
	providers: {
		bentoCache: factory({
			inject: ["config"],
			useFactory: (c) =>
				new BentoCache({
					default: "redis",
					stores: {
						redis: bentostore().useL2Layer(
							redisDriver({
								connection: {
									host: c.get("redisHost"),
									port: c.get("redisPort"),
								},
							}),
						),
					},
				}),
		}),
	},
});
