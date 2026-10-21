import { createDecoratorStateUpdater } from "awilixify";

export type LockOptions = {
	leaseMs: number;
	/** Delay between acquisition attempts. Defaults to 1,000 ms. */
	pollIntervalMs?: number;
	/** Total acquisition attempts, including the first. Defaults to 1; Infinity keeps polling. */
	maxPollAttempts?: number;
} & (
	| { renewalIntervalMs?: undefined; maxHoldMs?: never }
	| {
			/** Must be shorter than leaseMs. */
			renewalIntervalMs: number;
			/** Caps total lock ownership, not job execution. Must be >= leaseMs. */
			maxHoldMs?: number;
	  }
);

type DistributedLockConfig<TArgs extends unknown[] = unknown[]> =
	LockOptions & {
		key: (...args: TArgs) => string;
	};

type DistributedLockMethodState = {
	lock?: DistributedLockConfig<any[]>;
};

const updater = createDecoratorStateUpdater("distributedLock", {
	method: (): DistributedLockMethodState => ({}),
});

export const DISTRIBUTED_LOCK_METADATA_TOKEN = updater.token;

export function DistributedLock<TArgs extends unknown[]>(
	options: DistributedLockConfig<TArgs>,
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
			method: () => ({ lock: options }),
		});
	}
}
