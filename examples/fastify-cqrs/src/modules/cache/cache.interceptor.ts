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
		const namespace = this.bentoCache.namespace(this.namespace);
		const args = context.args;
		const { cache, evict } = context.metadata;

		if (evict) {
			const result = await context.proceed();
			const key = evict.key(...args);

			await Promise.resolve(namespace.delete({ key }));

			if (evict.tags?.length) {
				await namespace.deleteByTag({ tags: evict.tags });
			}

			return result;
		}

		if (cache) {
			return namespace.getOrSet({
				key: cache.key(...args),
				tags: cache.tags,
				factory: async () => context.proceed(),
				ttl: cache.ttl,
			});
		}

		return context.proceed();
	}
}
