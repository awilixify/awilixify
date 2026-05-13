import type { BuildResolverOptions, Constructor } from "awilix";
import type { EmptyObject } from "./common.types.js";
import type { ForwardRef, ModuleRef } from "./module-ref.types.js";
import type {
	AnyController,
	AnyInterceptor,
	ClassHandler,
	ClassMiddleware,
	DefInitializerMap,
	DefInterceptorMap,
	DefPreHandlerMap,
	DefProviderMap,
	Provider,
} from "./provider.types.js";
import type { InternalModuleLike } from "./runtime-module.types.js";

// ============================================================================
// Module Definition Types
// ============================================================================

declare const importModuleDefMarker: unique symbol;

// Lightweight structural carrier for module definition inference.
// We use it to extract imported module defs without forcing full Module<any>
// expansion in every type path.
export type ImportModule<TDef extends ModuleDefinition = ModuleDefinition> = {
	name: string;
	imports?: readonly unknown[];
	exports?: readonly string[];
	[importModuleDefMarker]?: TDef;
};

export type AnyModule = InternalModuleLike & ImportModule<any>;

export type ModuleImport = AnyModule | ModuleRef<any>;

export type ModuleDefinition = {
	providers?: DefProviderMap;
	exports?: DefProviderMap;
	imports?: ModuleImport[];
	queryHandlers?: readonly any[];
	commandHandlers?: readonly any[];
	queryPreHandlers?: DefPreHandlerMap;
	commandPreHandlers?: DefPreHandlerMap;
	interceptors?: DefInterceptorMap;
	initializers?: DefInitializerMap;

	exportKeys?: readonly string[];
	queryPreHandlerExportKeys?: readonly string[];
	commandPreHandlerExportKeys?: readonly string[];
	interceptorExportKeys?: readonly string[];
	initializerExportKeys?: readonly string[];
};

type NormalizeModuleDef<Def extends ModuleDefinition> = {
	deps: Def extends {
		deps: infer D extends Record<string, unknown>;
	}
		? D
		: Record<string, unknown>;

	providers: Def["providers"] extends DefProviderMap
		? Def["providers"]
		: EmptyObject;

	exports: Def["exports"] extends DefProviderMap ? Def["exports"] : EmptyObject;

	imports: Def["imports"] extends readonly unknown[]
		? Def["imports"]
		: readonly [];

	queryHandlers: Def["queryHandlers"] extends readonly any[]
		? Def["queryHandlers"]
		: readonly [];

	commandHandlers: Def["commandHandlers"] extends readonly any[]
		? Def["commandHandlers"]
		: readonly [];

	queryPreHandlers: Def["queryPreHandlers"] extends DefPreHandlerMap
		? Def["queryPreHandlers"]
		: EmptyObject;

	commandPreHandlers: Def["commandPreHandlers"] extends DefPreHandlerMap
		? Def["commandPreHandlers"]
		: EmptyObject;

	initializers: Def["initializers"] extends DefInitializerMap
		? Def["initializers"]
		: EmptyObject;

	interceptors: Def["interceptors"] extends DefInterceptorMap
		? Def["interceptors"]
		: EmptyObject;

	exportKeys: Def["exportKeys"] extends readonly string[]
		? Def["exportKeys"]
		: readonly [];

	queryPreHandlerExportKeys: Def["queryPreHandlerExportKeys"] extends readonly string[]
		? Def["queryPreHandlerExportKeys"]
		: readonly [];

	commandPreHandlerExportKeys: Def["commandPreHandlerExportKeys"] extends readonly string[]
		? Def["commandPreHandlerExportKeys"]
		: readonly [];

	initializerExportKeys: Def["initializerExportKeys"] extends readonly string[]
		? Def["initializerExportKeys"]
		: readonly [];

	interceptorExportKeys: Def["interceptorExportKeys"] extends readonly string[]
		? Def["interceptorExportKeys"]
		: readonly [];
};

export type Module<Def extends ModuleDefinition> = {
	name: string;
	controllers?: AnyController[];
	providerOptions?: Partial<BuildResolverOptions<any>>;
	[importModuleDefMarker]?: Def;
} & ModuleFromNormalized<NormalizeModuleDef<Def>>;

type ModuleFromNormalized<
	Def extends {
		deps: Record<string, unknown>;
		providers: DefProviderMap | EmptyObject;
		exports: DefProviderMap | EmptyObject;
		imports: readonly unknown[];
		queryHandlers: readonly any[];
		commandHandlers: readonly any[];
		interceptors: DefInterceptorMap | EmptyObject;
		initializers: DefInitializerMap | EmptyObject;
		queryPreHandlers: DefPreHandlerMap | EmptyObject;
		commandPreHandlers: DefPreHandlerMap | EmptyObject;

		exportKeys: readonly string[];
		queryPreHandlerExportKeys: readonly string[];
		commandPreHandlerExportKeys: readonly string[];
		initializerExportKeys: readonly string[];
		interceptorExportKeys: readonly string[];
	},
> = WithProviders<Def["providers"], Def["deps"]> &
	WithImports<Def["imports"]> &
	WithQueryHandlers<Def["queryHandlers"]> &
	WithCommandHandlers<Def["commandHandlers"]> &
	WithQueryPreHandlers<Def["queryPreHandlers"]> &
	WithCommandPreHandlers<Def["commandPreHandlers"]> &
	WithInitializers<Def["initializers"]> &
	WithInterceptors<Def["interceptors"]> &
	WithExports<Def["exportKeys"]> &
	WithQueryPreHandlerExports<Def["queryPreHandlerExportKeys"]> &
	WithCommandPreHandlerExports<Def["commandPreHandlerExportKeys"]> &
	WithInitializerExports<Def["initializerExportKeys"]> &
	WithInterceptorExports<Def["interceptorExportKeys"]>;

// ============================================================================
// Module Building Helpers
// ============================================================================

type WithProviders<
	TProviders extends DefProviderMap | EmptyObject,
	TDeps extends Record<string, unknown>,
> = TProviders extends EmptyObject
	? {
			providers?: EmptyObject;
		}
	: {
			providers: ToModuleProviderMap<TProviders, TDeps>;
		};

type WithExports<TKeys extends readonly string[]> = TKeys extends readonly []
	? { exports?: readonly [] }
	: { exports: TKeys };

type ToModuleProviderMap<
	T extends DefProviderMap,
	DepsMap extends Record<string, unknown> = Record<string, unknown>,
> = [keyof T] extends [never]
	? EmptyObject
	: {
			[K in keyof T]: T[K] extends object
				? Provider<T[K], DepsMap> | RawValueObject<T[K]>
				: T[K];
		};

// Allow plain object values (e.g. framework instances) while rejecting
// object literals that accidentally look like incomplete provider configs.
type RawValueObject<T> = T & {
	useClass?: never;
	useFactory?: never;
	provide?: never;
	lifetime?: never;
	allowCircular?: never;
};

// ============================================================================
// Handlers
// ============================================================================

type WithQueryHandlers<THandlers extends readonly any[]> =
	THandlers extends readonly []
		? { queryHandlers?: readonly [] }
		: { queryHandlers: ToModuleHandlerArray<THandlers> };

type WithCommandHandlers<THandlers extends readonly any[]> =
	THandlers extends readonly []
		? { commandHandlers?: readonly [] }
		: { commandHandlers: ToModuleHandlerArray<THandlers> };

type ToModuleHandlerArray<T extends readonly any[]> = T extends readonly []
	? readonly []
	: {
			readonly [K in keyof T]:
				| Constructor<T[K]>
				| ClassHandler<Constructor<T[K]>>;
		};

// ============================================================================
// PreHandler Types
// ============================================================================

type ToModulePreHandlerMap<T extends DefPreHandlerMap> = [keyof T] extends [
	never,
]
	? EmptyObject
	: {
			[K in keyof T]: Constructor<T[K]> | ClassMiddleware<Constructor<T[K]>>;
		};

type WithQueryPreHandlers<TPreHandlers extends DefPreHandlerMap | EmptyObject> =
	TPreHandlers extends EmptyObject
		? { queryPreHandlers?: EmptyObject }
		: { queryPreHandlers: ToModulePreHandlerMap<TPreHandlers> };

type WithCommandPreHandlers<
	TPreHandlers extends DefPreHandlerMap | EmptyObject,
> = TPreHandlers extends EmptyObject
	? { commandPreHandlers?: EmptyObject }
	: { commandPreHandlers: ToModulePreHandlerMap<TPreHandlers> };

type WithQueryPreHandlerExports<TKeys extends readonly string[]> =
	TKeys extends readonly []
		? { queryPreHandlerExports?: readonly [] }
		: { queryPreHandlerExports: TKeys };

type WithCommandPreHandlerExports<TKeys extends readonly string[]> =
	TKeys extends readonly []
		? { commandPreHandlerExports?: readonly [] }
		: { commandPreHandlerExports: TKeys };

type WithInitializers<TInitializers extends DefInitializerMap | EmptyObject> =
	TInitializers extends EmptyObject
		? { initializers?: EmptyObject }
		: { initializers: TInitializers };

type WithInitializerExports<TKeys extends readonly string[]> =
	TKeys extends readonly []
		? { initializerExports?: readonly [] }
		: { initializerExports: TKeys };

type ToModuleInterceptorMap<T extends DefInterceptorMap> = [keyof T] extends [
	never,
]
	? EmptyObject
	: {
			[K in keyof T]: AnyInterceptor;
		};

type WithInterceptors<TInterceptors extends DefInterceptorMap | EmptyObject> =
	TInterceptors extends EmptyObject
		? {
				interceptors?: EmptyObject;
			}
		: {
				interceptors: ToModuleInterceptorMap<TInterceptors>;
			};

type WithInterceptorExports<TKeys extends readonly string[]> =
	TKeys extends readonly []
		? { interceptorExports?: readonly [] }
		: { interceptorExports: TKeys };

// ============================================================================
// Imports
// ============================================================================

type WithImports<TImports extends readonly unknown[]> = 0 extends 1 & TImports
	? { imports?: (AnyModule | ForwardRef)[] }
	: TImports extends readonly []
		? { imports?: [] }
		: { imports: WithForwardRefImports<TImports> };

type WithForwardRefImports<T extends readonly unknown[]> = {
	[K in keyof T]: T[K] extends ModuleRef<infer MDef>
		? ForwardRef<ForwardRefModule<MDef>>
		: T[K] extends ImportModule<any>
			? T[K]
			: T[K];
};

type ForwardRefModule<MDef> = MDef extends {
	exports: infer E extends DefProviderMap;
	providers: infer P extends DefProviderMap;
}
	? {
			name: string;
			exports: readonly Extract<keyof E, string>[];
			providers: ToModuleProviderMap<P, any>;
		}
	: AnyModule;
