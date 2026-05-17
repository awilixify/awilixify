import type { Interceptor, InterceptContext } from "awilixify";
import {
	TaskCancelledError,
	timeout as createTimeoutPolicy,
	TimeoutStrategy,
} from "cockatiel";
import { httpException } from "awilixify/http";

import { runWithRequestSignal } from "./request-signal.context.js";
import { TIMEOUT_METADATA_TOKEN } from "./timeout.decorator.js";

type TimeoutToken = typeof TIMEOUT_METADATA_TOKEN;

export class TimeoutInterceptor implements Interceptor<TimeoutToken> {
	public readonly token = TIMEOUT_METADATA_TOKEN;
	private readonly policies = new Map<
		number,
		ReturnType<typeof createTimeoutPolicy>
	>();

	async intercept(context: InterceptContext<TimeoutToken>) {
		const { timeoutMs } = context.metadata;

		if (timeoutMs === undefined) {
			return context.proceed();
		}

		try {
			return await this.getPolicy(timeoutMs).execute(({ signal }) =>
				runWithRequestSignal(signal, () =>
					Promise.resolve(context.proceed()),
				),
			);
		} catch (error) {
			if (error instanceof TaskCancelledError) {
				throw httpException.requestTimeout("Operation timed out");
			}

			throw error;
		}
	}

	private getPolicy(timeoutMs: number) {
		const existing = this.policies.get(timeoutMs);

		if (existing) {
			return existing;
		}

		const created = createTimeoutPolicy(timeoutMs, {
			strategy: TimeoutStrategy.Aggressive,
			abortOnReturn: true,
		});

		this.policies.set(timeoutMs, created);

		return created;
	}
}
