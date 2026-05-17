import type { Interceptor, InterceptContext } from "awilixify";
import {
	ConstantBackoff,
	ExponentialBackoff,
	handleAll,
	retry as createRetryPolicy,
} from "cockatiel";

import { getRequestSignal } from "@/integrations/timeout/request-signal.context.js";

import {
	RETRY_METADATA_TOKEN,
	type RetryConfig,
} from "./retry.decorator.js";

type RetryToken = typeof RETRY_METADATA_TOKEN;

export class RetryInterceptor implements Interceptor<RetryToken> {
	public readonly token = RETRY_METADATA_TOKEN;

	private readonly policies = new Map<string, ReturnType<typeof createRetryPolicy>>();

	async intercept(context: InterceptContext<RetryToken>) {
		const config = context.metadata.retry;

		if (config === undefined) {
			return context.proceed();
		}

		const signal = getRequestSignal();

		return this.getPolicy(config).execute(() => context.proceed(), signal);
	}

	private getPolicy(config: RetryConfig) {
		const key = JSON.stringify(config);
		const existing = this.policies.get(key);

		if (existing) {
			return existing;
		}

		const created = createRetryPolicy(handleAll, {
			// Cockatiel counts retries after the initial call. Our decorator uses
			// total attempts, so `maxAttempts: 2` means "initial call + 1 retry".
			maxAttempts: Math.max(0, config.maxAttempts - 1),
			backoff: createBackoff(config),
		});

		this.policies.set(key, created);

		return created;
	}
}

function createBackoff(config: RetryConfig) {
	if (!config.backoff || config.backoff.type === "constant") {
		return new ConstantBackoff(config.backoff?.delayMs ?? 0);
	}

	return new ExponentialBackoff({
		initialDelay: config.backoff.initialDelayMs,
		maxDelay: config.backoff.maxDelayMs,
		exponent: config.backoff.exponent,
	});
}
