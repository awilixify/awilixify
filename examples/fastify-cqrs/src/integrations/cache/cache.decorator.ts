import { createDecoratorStateUpdater } from "awilixify";

type CacheOperationConfig<TArgs extends unknown[] = unknown[]> = {
	key: (...args: TArgs) => string;
	tags?: string[];
	ttl?: number;
};

type CacheMethodState<TArgs extends unknown[] = unknown[]> = {
	cache?: CacheOperationConfig<TArgs>;
	evict?: Omit<CacheOperationConfig<TArgs>, "ttl">;
};

const updater = createDecoratorStateUpdater("cache", {
	method: (): CacheMethodState<any[]> => ({}),
});

export const CACHE_METADATA_TOKEN = updater.token;

export function Cachable<TArgs extends unknown[]>(
	options: CacheOperationConfig<TArgs>,
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
		updater.update(
			context,
			{
				method: (previous) => ({
					...previous,
					cache: options,
				}),
			},
			Cachable.name,
		);
	}
}

export function CacheEvict<TArgs extends unknown[]>(
	options: Omit<CacheOperationConfig<TArgs>, "ttl">,
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
		updater.update(
			context,
			{
				method: (previous) => ({
					...previous,
					evict: options,
				}),
			},
			CacheEvict.name,
		);
	}
}
