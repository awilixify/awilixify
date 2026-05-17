import type { Interceptor, InterceptContext } from "awilixify";

import { getRequestSignal } from "./request-signal.context.js";
import { CANCELLABLE_METADATA_TOKEN } from "./cancellable.decorator.js";

type CancellableToken = typeof CANCELLABLE_METADATA_TOKEN;

export class CancellableInterceptor
	implements Interceptor<CancellableToken>
{
	public readonly token = CANCELLABLE_METADATA_TOKEN;

	async intercept(context: InterceptContext<CancellableToken>) {
		if (!context.metadata.cancellable) {
			return context.proceed();
		}

		const signal = getRequestSignal();

		if (signal === undefined) {
			return context.proceed();
		}

		if (signal.aborted) {
			throw signal.reason ?? new Error("Operation aborted");
		}

		// This rejects the awaited decorated call when the current request times
		// out. It cannot forcibly stop internal work that ignores cancellation.
		return Promise.race([
			Promise.resolve(context.proceed()),
			whenAborted(signal),
		]);
	}
}

function whenAborted(signal: AbortSignal): Promise<never> {
	return new Promise((_, reject) => {
		const onAbort = () => {
			signal.removeEventListener("abort", onAbort);
			reject(signal.reason ?? new Error("Operation aborted"));
		};

		signal.addEventListener("abort", onAbort, { once: true });
	});
}
