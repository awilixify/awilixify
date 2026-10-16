import { randomUUID } from "node:crypto";
import type { Interceptor, InterceptContext } from "awilixify";

import { CACHE_METADATA_TOKEN } from "./cache.decorator.js";
import { Deps } from "./cache.module.js";

type CacheToken = typeof CACHE_METADATA_TOKEN;

/**
 * Solves the invalidation race: an in-flight read can cache stale data after deletion.
 * Versioned keys keep that stale result invisible to subsequent reads.
 *
 * A → cache miss; reads old value from DB
 * B → updates DB; deletes cached value
 * A → caches its old value → cache is stale again
 */
export class CacheInterceptor implements Interceptor<CacheToken> {
	public readonly token = CACHE_METADATA_TOKEN;

	// Concurrent reads share a Promise within this interceptor instance only.
	private readonly pending = new Map<string, Promise<unknown>>();

	constructor(
		private readonly bentoCache: Deps["bentoCache"],
		private readonly namespace: Deps["namespace"],
		private readonly cacheRedisDriver: Deps["cacheRedisDriver"],
	) {}

	private versionKeys(key: string, tags: string[] = []) {
		// JSON produces string keys with unambiguous component boundaries.
		// Joining with ':' would collide for ['a:b', 'c'] and ['a', 'b:c'].
		return [
			JSON.stringify(["cache-version", this.namespace, "key", key]),
			...tags.map((tag) =>
				JSON.stringify(["cache-version", this.namespace, "tag", tag]),
			),
		];
	}

	async intercept(context: InterceptContext<CacheToken>) {
		const namespace = this.bentoCache.namespace(this.namespace);
		const args = context.args;
		const { cache, evict } = context.metadata;

		if (evict) {
			const result = await context.proceed();
			const key = evict.key(...args);

			const versionKeys = this.versionKeys(key, evict.tags);
			// Old generations become unreachable and expire under their existing TTL.
			await this.cacheRedisDriver
				.getConnection()
				// MSET atomically updates all related key and tag versions.
				.mset(
					...versionKeys.flatMap((versionKey) => [versionKey, randomUUID()]),
				);

			return result;
		}

		if (cache) {
			const key = cache.key(...args);
			const versionKeys = this.versionKeys(key, cache.tags);
			// Unique tokens prevent an evicted marker from reviving an old cache key.
			// EVAL runs Lua atomically: read version tokens, create missing ones, return all.
			// KEYS contains marker keys; ARGV[1] is the UUID for missing markers.
			const versions = (await this.cacheRedisDriver.getConnection().eval(
				`local versions = {}
				for i, key in ipairs(KEYS) do
					local version = redis.call('GET', key)
					if not version then
						version = ARGV[1]
						redis.call('SET', key, version)
					end
					versions[i] = version
				end
				return versions`,
				versionKeys.length, // Tells Redis where KEYS end and ARGV begins.
				...versionKeys, // KEYS
				randomUUID(), // ARGV[1],
			)) as string[];

			// Prevent stampedes within this instance by sharing one fetch per versioned key.
			const versionedKey = JSON.stringify([key, ...versions]);
			const existing = this.pending.get(versionedKey);

			if (existing) return existing;

			const fetch = namespace.getOrSet({
				key: versionedKey,
				factory: async () => context.proceed(),
				ttl: cache.ttl,
			});
			this.pending.set(versionedKey, fetch);

			try {
				return await fetch;
			} finally {
				// Failed fetches must not prevent later requests from retrying.
				this.pending.delete(versionedKey);
			}
		}

		return context.proceed();
	}
}
