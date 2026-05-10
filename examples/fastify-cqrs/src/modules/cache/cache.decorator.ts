import {
	createInterceptDecorator,
	createInterceptorMetadataToken,
} from "awilixify";

export type CacheMetadata<TArgs extends unknown[] = unknown[]> = {
	key: (...args: TArgs) => string;
	tags?: string[];
	ttl?: number;
};

export const CACHE_METADATA_TOKEN =
	createInterceptorMetadataToken<CacheMetadata<unknown[]>>("cache");

export function Cachable<TArgs extends unknown[]>(
	options: CacheMetadata<TArgs>,
) {
	const decorate = createInterceptDecorator(CACHE_METADATA_TOKEN)(options);

	return decorate as <TThis, TReturn>(
		target: (this: TThis, ...args: TArgs) => TReturn,
		context: ClassMethodDecoratorContext<
			TThis,
			(this: TThis, ...args: TArgs) => TReturn
		>,
	) => void;
}
