import { createDecoratorStateUpdater } from "awilixify";

export type RetryConfig = {
	maxAttempts: number;
	backoff?:
		| {
				type: "constant";
				delayMs: number;
		  }
		| {
				type: "exponential";
				initialDelayMs?: number;
				maxDelayMs?: number;
				exponent?: number;
		  };
};

type RetryMethodState = {
	retry?: RetryConfig;
};

const updater = createDecoratorStateUpdater("retry", {
	method: (): RetryMethodState => ({}),
});

export const RETRY_METADATA_TOKEN = updater.token;

export function retry(config: RetryConfig) {
	return (_target: any, context: ClassMethodDecoratorContext) => {
		updater.update(context, {
			method: (previous) => ({
				...previous,
				retry: config,
			}),
		});
	};
}
