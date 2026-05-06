import type { BuildResolverOptions, Constructor } from "awilix";
import type { EmptyObject, UnknownRecord } from "./common.types.js";
import type { ForwardRef, ModuleRef } from "./module-ref.types.js";
import type {
	AnyController,
	ClassHandler,
	ClassMiddleware,
	DefInterceptorMap,
	DefPreHandlerMap,
	DefProviderMap,
	Provider,
} from "./provider.types.js";

// ============================================================================
// Module Definition Types
// ============================================================================

export type AnyModule = StaticModule<any> & DynamicModuleOptions;
export type ModuleImport = AnyModule | ModuleRef<any>;

export type StaticModuleDef = {
	providers?: DefProviderMap;
	exports?: DefProviderMap;
	imports?: ModuleImport[];
	queryHandlers?: readonly any[];
	commandHandlers?: readonly any[];
	queryPreHandlers?: DefPreHandlerMap;
	commandPreHandlers?: DefPreHandlerMap;
	queryPreHandlerExports?: DefPreHandlerMap;
	commandPreHandlerExports?: DefPreHandlerMap;
	interceptors?: DefInterceptorMap;
	interceptorExports?: DefInterceptorMap;
};

export type DynamicModuleDef = StaticModuleDef & WithForRootConfig;

export type WithForRootConfig = {
	forRootConfig: UnknownRecord;
};

export type StaticModule<Def extends StaticModuleDef> = {
	name: string;
	controllers?: AnyController[];
	providerOptions?: Partial<BuildResolverOptions<any>>;
	interceptors?: Record<string, any>;
	interceptorExports?: Record<string, any>;
} & WithProviderMap<Def, "providers"> &
	WithProviderMap<Def, "exports"> &
	WithImports<Def> &
	WithHandlers<Def, "query"> &
	WithHandlers<Def, "command"> &
	WithPreHandlers<Def, "query"> &
	WithPreHandlers<Def, "command"> &
	WithPreHandlerExports<Def, "query"> &
	WithPreHandlerExports<Def, "command">;

export type DynamicModule<TDef extends DynamicModuleDef> = {
	forRoot(
		config: TDef["forRootConfig"],
		options?: DynamicModuleOptions,
	): StaticModule<TDef>;
};

export type DynamicModuleOptions = {
	registerControllers?: boolean;
};

// ============================================================================
// Module Building Helpers
// ============================================================================

type ProviderMapKey = "providers" | "exports";

type WithProviderMap<
	Def extends StaticModuleDef,
	TKey extends ProviderMapKey,
> = Def[TKey] extends DefProviderMap
	? Def[TKey] extends EmptyObject
		? { [K in TKey]?: ToModuleProviderMap<Def[TKey], ExtractDeps<Def>> }
		: { [K in TKey]: ToModuleProviderMap<Def[TKey], ExtractDeps<Def>> }
	: { [K in TKey]?: never };

type HandlerKindMap = {
	query: {
		handlersKey: "queryHandlers";
		preHandlersKey: "queryPreHandlers";
		preHandlerExportsKey: "queryPreHandlerExports";
	};
	command: {
		handlersKey: "commandHandlers";
		preHandlersKey: "commandPreHandlers";
		preHandlerExportsKey: "commandPreHandlerExports";
	};
};

type ExtractDeps<Def> = Def extends {
	deps: infer D;
}
	? D
	: Record<string, unknown>;

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

type WithHandlers<
	Def extends StaticModuleDef,
	TKind extends keyof HandlerKindMap,
> =
	ResolveHandlerArray<Def, TKind> extends readonly []
		? {
				[K in HandlerKindMap[TKind]["handlersKey"]]?: ToModuleHandlerArray<
					ResolveHandlerArray<Def, TKind>
				>;
			}
		: {
				[K in HandlerKindMap[TKind]["handlersKey"]]: ToModuleHandlerArray<
					ResolveHandlerArray<Def, TKind>
				>;
			};

type ResolveHandlerArray<
	Def extends StaticModuleDef,
	TKind extends keyof HandlerKindMap,
> = Def[HandlerKindMap[TKind]["handlersKey"]] extends readonly any[]
	? Def[HandlerKindMap[TKind]["handlersKey"]]
	: readonly [];

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

type WithPreHandlers<
	Def extends StaticModuleDef,
	TKind extends keyof HandlerKindMap,
> = Def[HandlerKindMap[TKind]["preHandlersKey"]] extends DefPreHandlerMap
	? Def[HandlerKindMap[TKind]["preHandlersKey"]] extends EmptyObject
		? {
				[K in HandlerKindMap[TKind]["preHandlersKey"]]?: ToModulePreHandlerMap<
					Def[HandlerKindMap[TKind]["preHandlersKey"]]
				>;
			}
		: {
				[K in HandlerKindMap[TKind]["preHandlersKey"]]: ToModulePreHandlerMap<
					Def[HandlerKindMap[TKind]["preHandlersKey"]]
				>;
			}
	: { [K in HandlerKindMap[TKind]["preHandlersKey"]]?: never };

type WithPreHandlerExports<
	Def extends StaticModuleDef,
	TKind extends keyof HandlerKindMap,
> = Def[HandlerKindMap[TKind]["preHandlerExportsKey"]] extends DefPreHandlerMap
	? Def[HandlerKindMap[TKind]["preHandlerExportsKey"]] extends EmptyObject
		? {
				[K in HandlerKindMap[TKind]["preHandlerExportsKey"]]?: ToModulePreHandlerMap<
					Def[HandlerKindMap[TKind]["preHandlerExportsKey"]]
				>;
			}
		: {
				[K in HandlerKindMap[TKind]["preHandlerExportsKey"]]: ToModulePreHandlerMap<
					Def[HandlerKindMap[TKind]["preHandlerExportsKey"]]
				>;
			}
	: { [K in HandlerKindMap[TKind]["preHandlerExportsKey"]]?: never };

// ============================================================================
// Imports
// ============================================================================

type WithImports<Def extends StaticModuleDef> = 0 extends 1 & Def
	? { imports?: (AnyModule | ForwardRef)[] }
	: Def["imports"] extends ModuleImport[]
		? Def["imports"] extends []
			? { imports?: [] }
			: { imports: WithForwardRefImports<Def["imports"]> }
		: { imports?: never };

type WithForwardRefImports<T extends readonly ModuleImport[]> = {
	[K in keyof T]: T[K] extends ModuleRef<infer MDef>
		? ForwardRef<ForwardRefModule<MDef>>
		: T[K] extends StaticModule<any>
			? T[K]
			: T[K];
};

type ForwardRefModule<MDef> = MDef extends {
	exports: infer E extends DefProviderMap;
	providers: infer P extends DefProviderMap;
}
	? {
			name: string;
			exports: ToModuleProviderMap<E, any>;
			providers: ToModuleProviderMap<P, any>;
		}
	: AnyModule;
