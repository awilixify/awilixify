import type { Interceptor, InterceptContext } from "awilixify";

import { CACHE_METADATA_TOKEN, type CacheMetadata } from "./cache.decorator.js";
import { Deps } from "./cache.module.js";

export class CacheInterceptor implements Interceptor<CacheMetadata> {
	public readonly token = CACHE_METADATA_TOKEN;

	constructor(
		private readonly bentoCache: Deps["bentoCache"],
		private readonly namespace: Deps["namespace"],
	) {}

	async intercept(context: InterceptContext<CacheMetadata>) {
		const cacheConfig = context.metadata[0];

		if (!cacheConfig?.key) {
			return context.proceed();
		}

		return this.bentoCache.namespace(this.namespace).getOrSet({
			key: cacheConfig.key(...context.args),
			tags: cacheConfig.tags,
			factory: async () => context.proceed(),
			ttl: cacheConfig.ttl,
		});
	}
}
