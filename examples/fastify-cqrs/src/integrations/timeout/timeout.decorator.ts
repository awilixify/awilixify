import { createDecoratorStateUpdater } from "awilixify";

type TimeoutMethodState = {
	timeoutMs?: number;
};

const updater = createDecoratorStateUpdater("timeout", {
	method: (): TimeoutMethodState => ({}),
});

export const TIMEOUT_METADATA_TOKEN = updater.token;

export function timeout(timeoutMs: number) {
	return (_target: any, context: ClassMethodDecoratorContext) => {
		updater.update(context, {
			method: (previous) => ({
				...previous,
				timeoutMs,
			}),
		});
	};
}
