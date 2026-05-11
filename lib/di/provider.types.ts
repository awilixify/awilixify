import type { BuildResolverOptions, Constructor } from "awilix";
import type { AnyContract } from "lib/mediator/contract.types.js";
import type { Handler } from "lib/mediator/handler.types.js";
import type {
	AnyMiddlewareContract,
	Middleware,
} from "lib/mediator/middleware.types.js";
import type {
	DecoratorMethodState,
	DecoratorState,
	DecoratorToken,
	MethodName,
} from "../decorators/decorator-state.types.js";

export type DefProviderMap = Record<string, object | string | boolean | number>;

/**
 * PreHandler map - accepts any type, will be converted to constructor type internally
 */
export type DefPreHandlerMap = Record<string, object>;
export type DefInterceptorMap = Record<string, object>;
export type DefInitializerMap = Record<string, ConstructorInitializer>;
// ============================================================================
// Provider Types
// ============================================================================

export type ConstructorProvider<T extends object = object> = Constructor<T>;
export type PrimitiveProvider = string | number | boolean | symbol | bigint;
export type FunctionProvider = (...args: any[]) => any;

export type FactoryProvider<
	T extends object,
	DepsMap extends Record<string, unknown>,
	Keys extends readonly (keyof DepsMap)[],
	Strict extends boolean = true,
> = {
	provide: Omit<ClassProvider<T>, "allowCircular"> | ConstructorProvider<T>;
	inject?: Keys;
	useFactory: Strict extends true
		? (...args: MapKeysToValues<DepsMap, Keys>) => T
		: (...args: any[]) => T;
};

export type ClassProvider<T extends object> = {
	useClass: Constructor<T>;
	allowCircular?: boolean;
} & BuildResolverOptions<T>;

export type Provider<
	T extends object,
	DepsMap extends Record<string, unknown> = Record<string, unknown>,
> =
	| FactoryProvider<T, DepsMap, readonly (keyof DepsMap)[], false>
	| ClassProvider<T>
	| ConstructorProvider<T>;

export type AnyProvider =
	| FactoryProvider<any, any, readonly string[], false>
	| ClassProvider<any>
	| ConstructorProvider<any>
	| PrimitiveProvider
	| FunctionProvider
	| object;

// ============================================================================
// Controller Types
// ============================================================================

export type ConstructorController = Constructor<Controller>;

export type ClassController = {
	useClass: ConstructorController | Constructor<any>;
} & BuildResolverOptions<any>;

export type AnyController =
	| ConstructorController
	| ClassController
	| Constructor<any>;

export interface Controller {
	registerRoutes: () => void;
}

// ============================================================================
// Handler Types
// ============================================================================

export interface ConstructorHandler<C extends AnyContract = AnyContract> {
	new (...args: any[]): Handler<C>;
}

export type ClassHandler<H extends Constructor<any> = Constructor<any>> = {
	useClass: H;
} & BuildResolverOptions<any>;

// ============================================================================
// Handler Middleware Types
// ============================================================================

export interface ConstructorMiddleware<
	C extends AnyMiddlewareContract = AnyMiddlewareContract,
> {
	new (...args: any[]): Middleware<C>;
}

export type ClassMiddleware<M extends Constructor<any> = Constructor<any>> = {
	useClass: M;
} & BuildResolverOptions<any>;

/**
 * Union type for any middleware (constructor or class-based).
 */
export type AnyMiddleware = ClassMiddleware | Constructor<Middleware>;

// ============================================================================
// Interceptor Types
// ============================================================================

export interface ConstructorInterceptor {
	new (...args: any[]): Interceptor;
}

export type ClassInterceptor<I extends Constructor<any> = Constructor<any>> = {
	useClass: I;
} & BuildResolverOptions<any>;

export type AnyInterceptor = ClassInterceptor | ConstructorInterceptor;

// ============================================================================
// Controller Initializer Types
// ============================================================================

type AnyDecoratorToken = DecoratorToken<DecoratorState<any, any>>;

export type InitializerContext<
	TToken extends AnyDecoratorToken = AnyDecoratorToken,
> = {
	moduleName: string;
	controllerClass: Constructor<any>;
	methodName: MethodName;
	metadata: DecoratorMethodState<TToken["state"]>;
	decoratorState: TToken["state"];
	invoke: (...args: unknown[]) => unknown | Promise<unknown>;
};

export interface Initializer<
	TToken extends AnyDecoratorToken = AnyDecoratorToken,
> {
	token: TToken;
	initialize: (context: InitializerContext<TToken>) => void | Promise<void>;
}

export interface ConstructorInitializer {
	new (...args: any[]): Initializer;
}

export type AnyInitializer = ConstructorInitializer;

// ============================================================================
// Interceptor Types
// ============================================================================

// TODO: same type for interceptor and initializer
export type InterceptContext<
	TToken extends AnyDecoratorToken = AnyDecoratorToken,
> = {
	target: object;
	methodName: MethodName;
	args: unknown[];
	proceed: () => unknown | Promise<unknown>;
	metadata: DecoratorMethodState<TToken["state"]>;
	decoratorState: TToken["state"];
};

export interface Interceptor<
	TToken extends AnyDecoratorToken = AnyDecoratorToken,
> {
	token: TToken;
	intercept(context: InterceptContext<TToken>): unknown | Promise<unknown>;
}

// ============================================================================
// Provider Mapping Helper
// ============================================================================

type MapKeysToValues<
	DepsMap extends Record<string, unknown>,
	Keys extends readonly (keyof DepsMap)[],
> = {
	[K in keyof Keys]: Keys[K] extends keyof DepsMap ? DepsMap[Keys[K]] : never;
};
