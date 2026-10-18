import { createHash, randomUUID } from "node:crypto";
import type { InterceptContext, Interceptor } from "awilixify";
import { httpException } from "awilixify/http";

import { IDEMPOTENCY_METADATA_TOKEN } from "./idempotent.decorator.js";
import type { Deps } from "./idempotency.module.js";
import { canonicalJson } from "./json.js";

type IdempotencyToken = typeof IDEMPOTENCY_METADATA_TOKEN;

type StoredRecord = {
	owner: string;
	fingerprint: string;
	status: "processing" | "completed";
	result?: unknown;
};

/**
 * Helps for:
 * Submit button double click
 * Prevents duplicate work when a timed-out client retries with the same key
 * Mobile app resends a request after reconnecting
 * Can reduce duplicate jobs across pods using a shared static key
 *  - Often sufficient for short jobs with close start time
 *  - Won't prevent duplicates after TTL expiry
 *
 * Protection ends if the Redis record expires or is lost;
 *
 * Doesn't guarantee exactly-once effects: use DB transactions
 * or downstream idempotency for payments and other critical effects.
 */
export class IdempotencyInterceptor implements Interceptor<IdempotencyToken> {
	public readonly token = IDEMPOTENCY_METADATA_TOKEN;

	constructor(
		private readonly idempotencyRedisDriver: Deps["idempotencyRedisDriver"],
	) {}

	async intercept(context: InterceptContext<IdempotencyToken>) {
		const config = context.metadata.idempotent;

		if (!config) return context.proceed();

		const key = config.key(...context.args);

		if (!key)
			throw httpException.badRequest("Idempotency key must not be empty");

		if (!Number.isSafeInteger(config.retentionMs) || config.retentionMs <= 0) {
			throw new Error("retentionMs must be a positive safe integer");
		}

		const fingerprint = createHash("sha256")
			.update(
				canonicalJson(
					config.fingerprint
						? config.fingerprint(...context.args)
						: context.args,
				),
			)
			.digest("hex");

		const redis = this.idempotencyRedisDriver.getConnection();
		const recordKey = JSON.stringify(["idempotency", key]);
		const record: StoredRecord = {
			owner: randomUUID(),
			fingerprint,
			status: "processing",
		};
		const claim = JSON.stringify(record);

		// Atomically claim an absent key or GET the existing value. Requires Redis 7+.
		// Null means acquired; a string is the unchanged record from another attempt.
		const existing = await redis.set(
			recordKey,
			claim,
			"PX",
			config.retentionMs,
			"NX",
			"GET",
		);

		if (existing !== null) {
			const stored = JSON.parse(existing) as StoredRecord;

			if (stored.fingerprint !== fingerprint)
				throw httpException.conflict(
					"Idempotency key was reused with different inputs",
					{ code: "conflict" },
				);

			if (stored.status !== "completed") {
				throw httpException.conflict(
					"Idempotency operation is still in progress or requires reconciliation",
					{ code: "in-progress" },
				);
			}

			return stored.result;
		}

		// Leave the claim on any error: the business effect may already have happened.
		const value = await context.proceed();

		const completed = JSON.stringify({
			...record,
			status: "completed",
			result: value,
		});

		// If retention expires while the original call still runs,
		// this prevents it from silenty overwriting a newer attempt's claim or result.
		const saved = await redis.eval(
			`if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
			redis.call('SET', KEYS[1], ARGV[2], 'PX', ARGV[3])
			return 1`,
			1, // Number of keys;
			recordKey, // KEYS[1]: idempotency key
			claim, // ARGV[1]: original claim
			completed, // ARGV[2]: completed record with the result to save.
			config.retentionMs, // ARGV[3]: new TTL in milliseconds.
		);

		if (saved !== 1)
			throw httpException.serviceUnavailable(
				"Idempotency record is no longer available",
				{ code: "state-lost" },
			);

		return value;
	}
}
