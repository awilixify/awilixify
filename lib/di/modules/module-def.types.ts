import type { Mediator } from "../../mediator/mediator.js";
import type { EmptyObject } from "../common.types.js";
import type {
	ClassHandler,
	DefInitializerMap,
	DefInterceptorMap,
	DefPreHandlerMap,
	DefProviderMap,
} from "../providers/provider.types.js";
import type {
	ImportModule,
	ModuleDefinition,
	ModuleImport,
} from "./module.types.js";

// biome-ignore lint/suspicious/noEmptyInterface: Intentionally empty for declaration merging
export interface GlobalDependencies {}

export type NormalizeGlobalDependencies<T> = [keyof T] extends [never]
	? EmptyObject
	: T extends object
		? T
		: EmptyObject;

export type InferGlobalDependencies<TModuleDef> = TModuleDef extends {
	exports: infer TExports;
}
	? NormalizeGlobalDependencies<TExports>
	: EmptyObject;

// ============================================================================
// ModuleDef
// ============================================================================

type HasDuplicates<T extends readonly unknown[]> = number extends T["length"]
	? false
	: T extends readonly [infer Head, ...infer Tail]
		? Head extends Tail[number]
			? true
			: HasDuplicates<Tail>
		: false;

type KeysOf<T> = Extract<keyof T, string>;

type ValidExportKeys<TMap, TKeys> = [TMap] extends [Record<string, unknown>]
	? TKeys extends readonly KeysOf<TMap>[]
		? HasDuplicates<TKeys> extends true
			? never
			: TKeys
		: readonly KeysOf<TMap>[]
	: never;

export type ModuleDef<
	D extends {
		providers?: DefProviderMap;
		interceptors?: DefInterceptorMap;
		initializers?: DefInitializerMap;
		imports?: readonly ModuleImport[];
		queryHandlers?: readonly any[];
		commandHandlers?: readonly any[];
		queryPreHandlers?: DefPreHandlerMap;
		commandPreHandlers?: DefPreHandlerMap;

		exportKeys?: ValidExportKeys<D["providers"], D["exportKeys"]>;
		exportQueryPreHandlerKeys?: ValidExportKeys<
			D["queryPreHandlers"],
			D["exportQueryPreHandlerKeys"]
		>;
		exportCommandPreHandlerKeys?: ValidExportKeys<
			D["commandPreHandlers"],
			D["exportCommandPreHandlerKeys"]
		>;
		exportInterceptorKeys?: ValidExportKeys<
			D["interceptors"],
			D["exportInterceptorKeys"]
		>;
		exportInitializerKeys?: ValidExportKeys<
			D["initializers"],
			D["exportInitializerKeys"]
		>;
	},
> = {
	providers: ExtractProviders<D["providers"]>;
	exports: ExtractExports<ExtractProviders<D["providers"]>, D["exportKeys"]>;
	queryPreHandlerExports: ExtractPreHandlerExports<
		ExtractPreHandlers<D["queryPreHandlers"]>,
		D["exportQueryPreHandlerKeys"]
	>;
	commandPreHandlerExports: ExtractPreHandlerExports<
		ExtractPreHandlers<D["commandPreHandlers"]>,
		D["exportCommandPreHandlerKeys"]
	>;
	interceptors: ExtractInterceptors<D["interceptors"]>;
	imports: ExtractImports<D["imports"]>;
	deps: ExtractDeps<D>;
	queryHandlers: ExtractHandlers<D["queryHandlers"]>;
	commandHandlers: ExtractHandlers<D["commandHandlers"]>;
	queryPreHandlers: ExtractPreHandlers<D["queryPreHandlers"]>;
	commandPreHandlers: ExtractPreHandlers<D["commandPreHandlers"]>;
	initializers: ExtractInitializers<D["initializers"]>;

	exportKeys: ExtractExportKeys<
		ExtractProviders<D["providers"]>,
		D["exportKeys"]
	>;
	queryPreHandlerExportKeys: ExtractPreHandlerExportKeys<
		ExtractPreHandlers<D["queryPreHandlers"]>,
		D["exportQueryPreHandlerKeys"]
	>;
	commandPreHandlerExportKeys: ExtractPreHandlerExportKeys<
		ExtractPreHandlers<D["commandPreHandlers"]>,
		D["exportCommandPreHandlerKeys"]
	>;
	interceptorExportKeys: ExtractInterceptorExportKeys<
		ExtractInterceptors<D["interceptors"]>,
		D["exportInterceptorKeys"]
	>;
	initializerExportKeys: ExtractInitializerExportKeys<
		ExtractInitializers<D["initializers"]>,
		D["exportInitializerKeys"]
	>;
};

// ============================================================================
// ModuleDef Extracts
// ============================================================================

type ExtractProviders<TProviders> = TProviders extends DefProviderMap
	? TProviders
	: EmptyObject;

type ExtractPreHandlerExports<TMap, TKeys> = TMap extends DefPreHandlerMap
	? TKeys extends readonly (keyof TMap)[]
		? Pick<TMap, TKeys[number]>
		: EmptyObject
	: EmptyObject;

type ExtractPreHandlerExportKeys<TMap, TKeys> = TMap extends DefPreHandlerMap
	? TKeys extends readonly (keyof TMap)[]
		? TKeys
		: readonly []
	: readonly [];

type ExtractExports<TProviders, TKeys> = TProviders extends DefProviderMap
	? TKeys extends readonly (keyof TProviders)[]
		? Pick<TProviders, TKeys[number]>
		: EmptyObject
	: EmptyObject;

type ExtractExportKeys<TProviders, TKeys> = TProviders extends DefProviderMap
	? TKeys extends readonly (keyof TProviders)[]
		? TKeys
		: readonly []
	: readonly [];

type ExtractImports<TImports> = TImports extends readonly ModuleImport[]
	? TImports
	: [];

type ExtractHandlers<THandlers> = THandlers extends readonly any[]
	? THandlers
	: [];

type ExtractPreHandlers<TPreHandlers> = TPreHandlers extends DefPreHandlerMap
	? TPreHandlers
	: EmptyObject;

type ExtractInterceptors<TInterceptors> =
	TInterceptors extends DefInterceptorMap ? TInterceptors : EmptyObject;

type ExtractInterceptorExportKeys<TInterceptors, TKeys> =
	TInterceptors extends DefInterceptorMap
		? TKeys extends readonly (keyof TInterceptors)[]
			? TKeys
			: readonly []
		: readonly [];

type ExtractInitializers<TInitializers> =
	TInitializers extends DefInitializerMap ? TInitializers : EmptyObject;

type ExtractInitializerExportKeys<TInitializers, TKeys> =
	TInitializers extends DefInitializerMap
		? TKeys extends readonly (keyof TInitializers)[]
			? TKeys
			: readonly []
		: readonly [];

// ============================================================================
// ExtractDeps
// ============================================================================

type ExtractDeps<
	D extends {
		providers?: DefProviderMap;
		imports?: readonly ModuleImport[];
		queryHandlers?: readonly any[];
		commandHandlers?: readonly any[];
	},
> = ExtractProviders<D["providers"]> &
	ExtractImportsExports<D> &
	ExtractQueryMediator<D> &
	ExtractCommandMediator<D> &
	NormalizeGlobalDependencies<GlobalDependencies>;

type ExtractImportsExports<D extends { imports?: readonly ModuleImport[] }> =
	D["imports"] extends readonly ModuleImport[]
		? ExtractExportsFromImports<D["imports"]>
		: EmptyObject;

type ExtractModuleDefFromModule<T> =
	Awaited<T> extends ImportModule<infer TDef extends ModuleDefinition>
		? TDef
		: Awaited<T> extends { exports: infer E }
			? { exports: E }
			: never;

type ExtractExportsFromImports<T extends readonly ModuleImport[]> =
	T extends readonly [
		infer First,
		...infer Rest extends readonly ModuleImport[],
	]
		? ExtractModuleDefFromModule<First> extends { exports: infer E }
			? E & ExtractExportsFromImports<Rest>
			: ExtractExportsFromImports<Rest>
		: EmptyObject;

// ============================================================================
// Mediator Extraction
// ============================================================================

type MediatorHandlerKey = "queryHandlers" | "commandHandlers";
type MediatorPreHandlerKey = "queryPreHandlers" | "commandPreHandlers";

type MediatorKindMap = {
	query: {
		handlerKey: "queryHandlers";
		preHandlerKey: "queryPreHandlers";
		preHandlerExportsKey: "queryPreHandlerExports";
		mediatorKey: "queryMediator";
	};
	command: {
		handlerKey: "commandHandlers";
		preHandlerKey: "commandPreHandlers";
		preHandlerExportsKey: "commandPreHandlerExports";
		mediatorKey: "commandMediator";
	};
};

type ExtractQueryMediator<
	D extends {
		queryHandlers?: readonly any[];
		queryPreHandlers?: DefPreHandlerMap;
		imports?: readonly ModuleImport[];
	},
> = ExtractMediator<"query", D>;

type ExtractCommandMediator<
	D extends {
		commandHandlers?: readonly any[];
		commandPreHandlers?: DefPreHandlerMap;
		imports?: readonly ModuleImport[];
	},
> = ExtractMediator<"command", D>;

type ExtractMediator<
	TKind extends keyof MediatorKindMap,
	D extends Partial<Record<MediatorHandlerKey, readonly any[]>> &
		Partial<Record<MediatorPreHandlerKey, DefPreHandlerMap>> & {
			imports?: readonly ModuleImport[];
		},
> = D[MediatorKindMap[TKind]["handlerKey"]] extends readonly [any, ...any[]]
	? {
			[K in MediatorKindMap[TKind]["mediatorKey"]]: Mediator<
				ExtractContractsFromHandlers<D[MediatorKindMap[TKind]["handlerKey"]]>
			>;
		}
	: EmptyObject;

type ExtractContractsFromHandlers<Handlers extends readonly any[]> =
	Handlers extends readonly [infer First, ...infer Rest]
		? ExtractContractFromHandler<First> | ExtractContractsFromHandlers<Rest>
		: never;

type UnwrapClassHandler<H> = H extends ClassHandler ? H["useClass"] : H;

type ExtractContractFromHandler<H> =
	UnwrapClassHandler<H> extends new (
		...args: any[]
	) => infer I
		? I extends { contract: infer C }
			? C
			: never
		: UnwrapClassHandler<H> extends { contract: infer C }
			? C
			: never;
