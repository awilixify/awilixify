import { createDecoratorStateUpdater } from "awilixify";

export type IdempotencyConfig<TArgs extends unknown[] = unknown[]> = {
	// Include the operation and tenant/user scope, not just a client-supplied UUID.
	key: (...args: TArgs) => string;
	// Must exceed execution time and the retry window. Expiry permits execution again.
	retentionMs: number;
	// Defaults to all method arguments. Select stable business inputs, not request objects.
	fingerprint?: (...args: TArgs) => unknown;
};

type IdempotencyMethodState = {
	idempotent?: IdempotencyConfig<any[]>;
};

const updater = createDecoratorStateUpdater("idempotency", {
	method: (): IdempotencyMethodState => ({}),
});

export const IDEMPOTENCY_METADATA_TOKEN = updater.token;

export function Idempotent<TArgs extends unknown[]>(
	options: IdempotencyConfig<TArgs>,
) {
	return decorate as <TThis, TReturn>(
		target: (this: TThis, ...args: TArgs) => TReturn,
		context: ClassMethodDecoratorContext<
			TThis,
			(this: TThis, ...args: TArgs) => TReturn
		>,
	) => void;

	function decorate<TThis, TReturn>(
		_target: (this: TThis, ...args: TArgs) => TReturn,
		context: ClassMethodDecoratorContext<
			TThis,
			(this: TThis, ...args: TArgs) => TReturn
		>,
	): void {
		updater.update(context, {
			method: () => ({ idempotent: options }),
		});
	}
}
