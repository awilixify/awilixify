import type { BuildResolverOptions, Constructor } from "awilix";
import type {
	AnyDecoratorToken,
	DecoratorExecutionContext,
} from "./decorator-context.types.js";

export type DefInterceptorMap = Record<string, object>;

export interface ConstructorInterceptor {
	new (...args: any[]): Interceptor;
}

export type ClassInterceptor<I extends Constructor<any> = Constructor<any>> = {
	useClass: I;
} & BuildResolverOptions<any>;

export type AnyInterceptor = ClassInterceptor | ConstructorInterceptor;

export type InterceptContext<
	TToken extends AnyDecoratorToken = AnyDecoratorToken,
> = DecoratorExecutionContext<TToken> & {
	args: unknown[];
	proceed: () => unknown | Promise<unknown>;
};

export interface Interceptor<
	TToken extends AnyDecoratorToken = AnyDecoratorToken,
> {
	token: TToken;
	intercept(context: InterceptContext<TToken>): unknown | Promise<unknown>;
}
