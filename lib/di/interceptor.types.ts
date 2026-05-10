import type { MethodName } from "../decorators/http-state.js";

export type InterceptorMetadataToken<T> = {
	key: symbol;
	readonly __meta?: T;
};

export function createInterceptorMetadataToken<T>(
	description: string,
): InterceptorMetadataToken<T> {
	return {
		key: Symbol(description),
	};
}

export type InterceptContext<M = unknown> = {
	target: object;
	methodName: MethodName;
	args: unknown[];
	proceed: () => unknown | Promise<unknown>;
	metadata: M;
};

export interface Interceptor<M = unknown> {
	token: InterceptorMetadataToken<M>;
	intercept(context: InterceptContext<M>): unknown | Promise<unknown>;
}
