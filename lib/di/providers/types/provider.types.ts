import type { BuildResolverOptions, Constructor } from "awilix";
import { InitHook, ShutdownHook } from "../../lifecycle-hooks.js";

export type DefProviderMap = Record<string, object | string | boolean | number>;

type ConstructorProvider<T extends object = object> = Constructor<T>;
export type PrimitiveProvider = string | number | boolean | symbol | bigint;
export type FunctionProvider = (...args: any[]) => any;

export type FactoryProvider<
	T extends object,
	DepsMap extends Record<string, unknown>,
	Keys extends readonly Extract<keyof DepsMap, string>[],
	Strict extends boolean = true,
	ResolverOptions extends object = BuildResolverOptions<T>,
> = {
	inject?: Keys;
	initAfter?: readonly Extract<keyof DepsMap, string>[];
	eager?: boolean;
	useFactory: Strict extends true
		? (...args: MapKeysToValues<DepsMap, Keys>) => T | Promise<T>
		: (...args: any[]) => T | Promise<T>;
} & ResolverOptions;

type ClassProvider<
	T extends object,
	DepsMap extends Record<string, unknown> = Record<string, unknown>,
	ResolverOptions extends object = BuildResolverOptions<T>,
> = {
	useClass: Constructor<T>;
	allowCircular?: boolean;
	eager?: boolean;
	initAfter?: readonly Extract<keyof DepsMap, string>[];
} & ResolverOptions;

export interface OnInit {
	[InitHook.OnInit](): void | Promise<void>;
}

export interface AfterInit {
	[InitHook.AfterInit](): void | Promise<void>;
}

export interface BeforeShutdown {
	[ShutdownHook.BeforeShutdown](): void | Promise<void>;
}

export interface OnShutdown {
	[ShutdownHook.OnShutdown](): void | Promise<void>;
}

export type Provider<
	T extends object,
	DepsMap extends Record<string, unknown> = Record<string, unknown>,
	ResolverOptions extends object = BuildResolverOptions<T>,
> =
	| FactoryProvider<
			T,
			DepsMap,
			readonly Extract<keyof DepsMap, string>[],
			false
	  >
	| ClassProvider<T, DepsMap, ResolverOptions>
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
	Keys extends readonly Extract<keyof DepsMap, string>[],
> = {
	[K in keyof Keys]: Keys[K] extends keyof DepsMap ? DepsMap[Keys[K]] : never;
};
