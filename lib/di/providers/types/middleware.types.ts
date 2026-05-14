import type { BuildResolverOptions, Constructor } from "awilix";
import type {
	AnyMiddlewareContract,
	Middleware,
} from "lib/mediator/middleware.types.js";

/**
 * PreHandler map - accepts any type, will be converted to constructor type internally
 */
export type DefPreHandlerMap = Record<string, object>;

export interface ConstructorMiddleware<
	C extends AnyMiddlewareContract = AnyMiddlewareContract,
> {
	new (...args: any[]): Middleware<C>;
}

export type ClassMiddleware<M extends Constructor<any> = Constructor<any>> = {
	useClass: M;
} & BuildResolverOptions<any>;

export type AnyMiddleware = ClassMiddleware | Constructor<Middleware>;
