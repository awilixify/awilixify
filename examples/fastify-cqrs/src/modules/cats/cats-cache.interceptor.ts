import type { Interceptor, InterceptContext } from "awilix-modular";

type CacheEntry = {
	expiresAt: number;
	value: unknown;
};

const cache = new Map<string, CacheEntry>();

export class CatsCacheInterceptor implements Interceptor {
	async intercept(context: InterceptContext) {
		console.log(context, "intercepted!!");
		const cachable = context.meta.cachable as
			| { tag?: string; ttlMs?: number }
			| undefined;

		if (!cachable?.tag) {
			return context.proceed();
		}

		const key = `${cachable.tag}:${JSON.stringify(context.args)}`;
		const now = Date.now();
		const cached = cache.get(key);

		if (cached && cached.expiresAt > now) {
			return cached.value;
		}

		const value = await context.proceed();
		cache.set(key, {
			value,
			expiresAt: now + (cachable.ttlMs ?? 5000),
		});

		return value;
	}
}
