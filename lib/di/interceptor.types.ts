import type { MethodName } from "../decorators/http-state.js";

export type InterceptContext = {
	target: object;
	methodName: MethodName;
	args: unknown[];
	proceed: () => unknown | Promise<unknown>;
	meta: Record<string, unknown>;
};

export interface Interceptor {
	intercept(context: InterceptContext): unknown | Promise<unknown>;
}
