import { createInterceptDecorator } from "awilixify";

type CachableOptions = {
	ttlMs?: number;
};

export function Cachable(tag: string, options?: CachableOptions) {
	return createInterceptDecorator("cachable")({
		tag,
		...options,
	});
}
