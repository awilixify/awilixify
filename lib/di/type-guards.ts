import type { BuildResolverOptions, Constructor } from "awilix";
import type { ForwardRef } from "./modules/module-ref.types.js";
import type {
	FactoryProvider,
	FunctionProvider,
	PrimitiveProvider,
} from "./providers/provider.types.js";

export function hasUseClass<T extends object = object>(
	value: unknown,
): value is {
	useClass: Constructor<T>;
	allowCircular?: boolean;
	eager?: boolean;
	initAfter?: readonly string[];
} & Partial<BuildResolverOptions<any>> {
	return typeof value === "object" && value !== null && "useClass" in value;
}

export function isFactoryProvider<T extends object>(
	provider: unknown,
): provider is FactoryProvider<T, any, readonly string[], false> {
	return (
		typeof provider === "object" &&
		provider !== null &&
		"useFactory" in provider
	);
}

export function isAsyncFactoryProvider(provider: unknown): boolean {
	return (
		isFactoryProvider(provider) &&
		provider.useFactory.constructor.name === "AsyncFunction"
	);
}

export function isCostructorProvider<T extends object>(
	provider: unknown,
): provider is Constructor<T> {
	if (typeof provider !== "function") return false;

	// Arrow functions don't have prototype
	if (!("prototype" in provider)) return false;

	const proto = provider.prototype;

	if (!proto || typeof proto !== "object") return false;

	const protoKeys = Object.getOwnPropertyNames(proto);

	if (
		protoKeys.length === 0 ||
		(protoKeys.length === 1 && protoKeys[0] === "constructor")
	) {
		return provider.toString().trim().startsWith("class");
	}

	// If prototype has methods/properties, it's a class
	return true;
}

export function isPrimitive(provider: unknown): provider is PrimitiveProvider {
	return (
		typeof provider === "string" ||
		typeof provider === "number" ||
		typeof provider === "boolean" ||
		typeof provider === "symbol" ||
		typeof provider === "bigint"
	);
}

export function isPlainFunction(
	provider: unknown,
): provider is FunctionProvider {
	return (
		typeof provider === "function" &&
		(!provider.prototype || Object.keys(provider.prototype).length === 0)
	);
}

export function isForwardRef(value: unknown): value is ForwardRef {
	return (
		typeof value === "object" &&
		value !== null &&
		"__forward_ref__" in value &&
		value.__forward_ref__ === true &&
		"resolve" in value &&
		typeof value.resolve === "function"
	);
}

export function isPromiseLike<T = unknown>(
	value: unknown,
): value is Promise<T> {
	return (
		typeof value === "object" &&
		value !== null &&
		"then" in value &&
		typeof value.then === "function"
	);
}

export function isEagerProvider(
	provider: unknown,
): provider is { eager: true } {
	return (
		typeof provider === "object" &&
		provider !== null &&
		"eager" in provider &&
		provider.eager === true
	);
}

export function hasProviderInit(
	value: unknown,
): value is { init: () => void | Promise<void> } {
	return (
		typeof value === "object" &&
		value !== null &&
		"init" in value &&
		typeof value.init === "function"
	);
}

export function hasInitAfter(
	provider: unknown,
): provider is { initAfter: readonly string[] } {
	return (
		typeof provider === "object" &&
		provider !== null &&
		"initAfter" in provider &&
		Array.isArray(provider.initAfter)
	);
}
