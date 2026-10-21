import { randomUUID } from "node:crypto";
import type { InterceptContext, Interceptor } from "awilixify";

import {
	DISTRIBUTED_LOCK_METADATA_TOKEN,
	type LockOptions,
} from "./distributed-lock.decorator.js";
import type { Deps } from "./distributed-lock.module.js";

type LockToken = typeof DISTRIBUTED_LOCK_METADATA_TOKEN;

export class DistributedLockInterceptor implements Interceptor<LockToken> {
	public readonly token = DISTRIBUTED_LOCK_METADATA_TOKEN;

	constructor(private readonly redis: Deps["redis"]) {}

	async intercept(context: InterceptContext<LockToken>) {
		const { lock: options } = context.metadata;

		if (!options) return context.proceed();

		const key = options.key(...context.args);

		this.validateOptions(key, options);

		const lockKey = JSON.stringify(["distributed-lock", key]);
		const token = randomUUID();

		if (!(await this.acquireLock(lockKey, token, options))) return;

		const renewal = this.createLeaseRenewal(lockKey, token, key, options);

		try {
			renewal?.scheduleRenewal();

			return await context.proceed();
		} finally {
			await renewal?.stopRenewal();
			await this.redis.eval(
				`if redis.call('GET', KEYS[1]) == ARGV[1] then
					return redis.call('DEL', KEYS[1])
				end
				return 0`,
				1,
				lockKey,
				token,
			);
		}
	}

	private validateOptions(key: string, options: LockOptions) {
		if (!key) throw new Error("Distributed lock key must not be empty");

		if (!Number.isSafeInteger(options.leaseMs) || options.leaseMs <= 0) {
			throw new Error("leaseMs must be a positive safe integer");
		}

		const {
			pollIntervalMs = 1_000,
			maxPollAttempts = 1,
			renewalIntervalMs,
			maxHoldMs,
		} = options;

		if (
			!Number.isSafeInteger(pollIntervalMs) ||
			pollIntervalMs <= 0 ||
			pollIntervalMs > 2_147_483_647
		) {
			throw new Error(
				"pollIntervalMs must be a positive safe integer within the timer limit",
			);
		}

		if (
			maxPollAttempts !== Infinity &&
			(!Number.isSafeInteger(maxPollAttempts) || maxPollAttempts <= 0)
		) {
			throw new Error(
				"maxPollAttempts must be a positive safe integer or Infinity",
			);
		}

		if (
			maxHoldMs !== undefined &&
			(!Number.isSafeInteger(maxHoldMs) || maxHoldMs < options.leaseMs)
		) {
			throw new Error(
				"maxHoldMs must be a safe integer greater than or equal to leaseMs",
			);
		}

		if (renewalIntervalMs === undefined) {
			if (maxHoldMs !== undefined) {
				throw new Error("maxHoldMs requires renewalIntervalMs");
			}

			return;
		}

		if (
			!Number.isSafeInteger(renewalIntervalMs) ||
			renewalIntervalMs <= 0 ||
			renewalIntervalMs >= options.leaseMs ||
			renewalIntervalMs > 2_147_483_647
		) {
			throw new Error(
				"renewalIntervalMs must be a positive safe integer below leaseMs and within the timer limit",
			);
		}
	}

	private async acquireLock(
		lockKey: string,
		token: string,
		options: LockOptions,
	) {
		const { pollIntervalMs = 1_000, maxPollAttempts = 1 } = options;

		for (let attempt = 0; attempt < maxPollAttempts; attempt++) {
			const acquired = await this.redis.set(
				lockKey,
				token,
				"PX",
				options.leaseMs,
				"NX",
			);

			if (acquired === "OK") return true;

			if (attempt + 1 < maxPollAttempts) {
				await new Promise<void>((resolve) =>
					setTimeout(resolve, pollIntervalMs),
				);
			}
		}

		return false;
	}

	private createLeaseRenewal(
		lockKey: string,
		token: string,
		key: string,
		options: LockOptions,
	) {
		const { renewalIntervalMs, maxHoldMs } = options;

		if (renewalIntervalMs === undefined) return;

		const deadline = performance.now() + (maxHoldMs ?? Infinity);

		// Clearing the timer won't stop a pending Redis request from rescheduling it
		let stopped = false;
		let timer: ReturnType<typeof setTimeout> | undefined;
		let pendingRenewal = Promise.resolve();

		const scheduleRenewal = () => {
			const remainingMs = deadline - performance.now();
			if (stopped || remainingMs <= renewalIntervalMs) return;

			timer = setTimeout(() => {
				pendingRenewal = renew();
			}, renewalIntervalMs);
		};

		const renew = async () => {
			const leaseMs = Math.floor(
				Math.min(options.leaseMs, deadline - performance.now()),
			);

			if (leaseMs <= 0) return;

			try {
				const renewed = await this.redis.eval(
					`if redis.call('GET', KEYS[1]) == ARGV[1] then
						return redis.call('PEXPIRE', KEYS[1], ARGV[2])
					end
					return 0`,
					1,
					lockKey,
					token,
					leaseMs,
				);

				if (renewed !== 1) {
					console.error(`[DistributedLock] lease lost: ${key}`);
					return;
				}

				scheduleRenewal();
			} catch (cause) {
				console.error(`[DistributedLock] lease renewal failed: ${key}`, cause);
			}
		};
		const stopRenewal = async () => {
			stopped = true;
			clearTimeout(timer);
			// Finish any in-flight renewal before releasing ownership.
			await pendingRenewal;
		};

		return { scheduleRenewal, stopRenewal };
	}
}
