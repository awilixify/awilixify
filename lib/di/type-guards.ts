import type { Constructor } from "awilix";
import type { ForwardRef } from "./module-ref.types.js";
import type {
	ClassController,
	ClassHandler,
	ClassInterceptor,
	ClassMiddleware,
	ClassProvider,
	FactoryProvider,
	FunctionProvider,
	PrimitiveProvider,
} from "./provider.types.js";

export function isClassHandler(handler: unknown): handler is ClassHandler {
	return (
		typeof handler === "object" && handler !== null && "useClass" in handler
	);
}

// TODO: better guard!!
export function isClassController(
	controller: unknown,
): controller is ClassController {
	return (
		typeof controller === "object" &&
		controller !== null &&
		"useClass" in controller
	);
}

export function isClassMiddleware(
	middleware: unknown,
): middleware is ClassMiddleware {
	return (
		typeof middleware === "object" &&
		middleware !== null &&
		"useClass" in middleware
	);
}

export function isClassInterceptor(
	interceptor: unknown,
): interceptor is ClassInterceptor {
	return (
		typeof interceptor === "object" &&
		interceptor !== null &&
		"useClass" in interceptor
	);
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

export function isClassProvider<T extends object>(
	provider: unknown,
): provider is ClassProvider<T> {
	return (
		typeof provider === "object" && provider !== null && "useClass" in provider
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
