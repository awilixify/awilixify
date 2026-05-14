import type { BuildResolverOptions, Constructor } from "awilix";

export type DefProviderMap = Record<string, object | string | boolean | number>;

export type ConstructorProvider<T extends object = object> = Constructor<T>;
export type PrimitiveProvider = string | number | boolean | symbol | bigint;
export type FunctionProvider = (...args: any[]) => any;

export type FactoryProvider<
	T extends object,
	DepsMap extends Record<string, unknown>,
	Keys extends readonly (keyof DepsMap)[],
	Strict extends boolean = true,
> = {
	inject?: Keys;
	useFactory: Strict extends true
		? (...args: MapKeysToValues<DepsMap, Keys>) => T | Promise<T>
		: (...args: any[]) => T | Promise<T>;
} & BuildResolverOptions<T>;

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

type MapKeysToValues<
	DepsMap extends Record<string, unknown>,
	Keys extends readonly (keyof DepsMap)[],
> = {
	[K in keyof Keys]: Keys[K] extends keyof DepsMap ? DepsMap[Keys[K]] : never;
};
