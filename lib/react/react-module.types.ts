import type {
	BuildResolverOptions,
	ContainerOptions,
	LifetimeType,
} from "awilix";

import type { EmptyObject } from "../di/common.types.js";
import type { ModuleImport } from "../di/modules/module.types.js";
import type {
	GlobalDependencies,
	NormalizeGlobalDependencies,
} from "../di/modules/module-def.types.js";
import type {
	DefProviderMap,
	Provider,
} from "../di/providers/provider.types.js";

export type ReactComponent<TProps = any, TResult = any> = (
	props: TProps,
) => TResult;

declare const reactImportModuleDefMarker: unique symbol;

export type ReactImportModule<
	TDef extends ModuleDefinition = ModuleDefinition,
> = {
	name: string;
	[reactImportModuleDefMarker]?: TDef;
};

export type ReactModuleImport = ModuleImport | ReactImportModule<any>;

declare const reactComponentPropsMarker: unique symbol;

export type WithDeps<TProps, TDeps = Record<string, unknown>> = TProps & {
	readonly deps: TDeps;
	readonly [reactComponentPropsMarker]?: TProps;
};

export type WithDepsOnly<TDeps = Record<string, unknown>> = WithDeps<
	Record<string, never>,
	TDeps
>;

type PropsWithoutDeps<TProps> = TProps extends {
	readonly [reactComponentPropsMarker]?: infer TPublicProps;
}
	? TPublicProps
	: Omit<TProps, "deps">;

export type WithoutDeps<TComponent> = TComponent extends (
	props: infer TProps,
) => infer TResult
	? (props: PropsWithoutDeps<TProps>) => TResult
	: never;

export type WithoutDepsComponentMap<TComponents> =
	TComponents extends Record<string, ReactComponent>
		? {
				[K in keyof TComponents]: WithoutDeps<TComponents[K]>;
			}
		: EmptyObject;

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
		components?: Record<string, ReactComponent>;
		imports?: readonly ReactModuleImport[];
		exportKeys?: ValidExportKeys<D["providers"], D["exportKeys"]>;
		componentExportKeys?: ValidExportKeys<
			D["components"],
			D["componentExportKeys"]
		>;
	},
> = {
	providers: ExtractProviders<D["providers"]>;
	exports: ExtractExports<ExtractProviders<D["providers"]>, D["exportKeys"]>;
	components: ExtractComponents<D["components"]>;
	componentExports: ExtractComponentExports<
		ExtractComponents<D["components"]>,
		D["componentExportKeys"]
	>;
	imports: ExtractImports<D["imports"]>;
	providerDeps: ExtractProviderDeps<D>;
	deps: ExtractComponentDeps<D>;
	exportKeys: ExtractExportKeys<
		ExtractProviders<D["providers"]>,
		D["exportKeys"]
	>;
	componentExportKeys: ExtractComponentExportKeys<
		ExtractComponents<D["components"]>,
		D["componentExportKeys"]
	>;
};

export type InferComponentDeps<TModuleDef extends { deps: object }> =
	TModuleDef["deps"];

export type InferProviderDeps<TModuleDef extends { providerDeps: object }> =
	TModuleDef["providerDeps"];

type NormalizeModuleDef<Def extends ModuleDefinition> = {
	providers: Def["providers"] extends DefProviderMap
		? Def["providers"]
		: EmptyObject;
	exports: Def["exports"] extends DefProviderMap ? Def["exports"] : EmptyObject;
	components: Def["components"] extends Record<string, ReactComponent>
		? Def["components"]
		: EmptyObject;
	componentExports: Def["componentExports"] extends Record<
		string,
		ReactComponent
	>
		? Def["componentExports"]
		: EmptyObject;
	imports: Def["imports"] extends readonly ReactModuleImport[]
		? Def["imports"]
		: readonly [];
	deps: Def["deps"] extends object ? Def["deps"] : EmptyObject;
	providerDeps: Def["providerDeps"] extends object
		? Def["providerDeps"]
		: EmptyObject;
	exportKeys: Def["exportKeys"] extends readonly string[]
		? Def["exportKeys"]
		: readonly [];
	componentExportKeys: Def["componentExportKeys"] extends readonly string[]
		? Def["componentExportKeys"]
		: readonly [];
};

export type Module<Def extends ModuleDefinition> = ModuleFromDef<
	NormalizeModuleDef<Def>
> &
	ReactImportModule<Def>;

type ModuleFromDef<
	Def extends {
		providers: DefProviderMap | EmptyObject;
		components: Record<string, ReactComponent> | EmptyObject;
		imports: readonly ReactModuleImport[];
		deps: object;
		providerDeps: object;
		exportKeys: readonly string[];
		componentExportKeys: readonly string[];
	},
> = {
	name: string;
	containerOptions?: ContainerOptions;
	providerOptions?: NonScopedResolverOptions<any>;
} & WithProviders<Def["providers"], Def["providerDeps"]> &
	WithImports<Def["imports"]> &
	WithExports<Def["exportKeys"]> &
	WithComponents<Def["components"]> &
	WithComponentExports<Def["componentExportKeys"]>;

export type ModuleDefinition = {
	providers?: DefProviderMap;
	exports?: DefProviderMap;
	components?: Record<string, ReactComponent>;
	componentExports?: Record<string, ReactComponent>;
	imports?: ReactModuleImport[];
	deps?: object;
	providerDeps?: object;
	exportKeys?: readonly string[];
	componentExportKeys?: readonly string[];
};

type ExtractProviders<TProviders> = TProviders extends DefProviderMap
	? TProviders
	: EmptyObject;

type ExtractComponents<TComponents> =
	TComponents extends Record<string, ReactComponent>
		? TComponents
		: EmptyObject;

type ExtractImports<TImports> = TImports extends readonly ReactModuleImport[]
	? TImports
	: [];

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

type ExtractComponentExports<TComponents, TKeys> =
	TComponents extends Record<string, ReactComponent>
		? TKeys extends readonly (keyof TComponents)[]
			? Pick<TComponents, TKeys[number]>
			: EmptyObject
		: EmptyObject;

type ExtractComponentExportKeys<TComponents, TKeys> =
	TComponents extends Record<string, ReactComponent>
		? TKeys extends readonly (keyof TComponents)[]
			? TKeys
			: readonly []
		: readonly [];

type ExtractProviderDeps<
	D extends {
		providers?: DefProviderMap;
		imports?: readonly ReactModuleImport[];
	},
> = ExtractProviders<D["providers"]> &
	ExtractImportsExports<D> &
	NormalizeGlobalDependencies<GlobalDependencies>;

type ExtractComponentDeps<
	D extends {
		providers?: DefProviderMap;
		components?: Record<string, ReactComponent>;
		imports?: readonly ReactModuleImport[];
	},
> = ExtractProviderDeps<D> &
	WithoutDepsComponentMap<ExtractComponents<D["components"]>> &
	ExtractImportsComponentExports<D>;

type ExtractImportsExports<
	D extends { imports?: readonly ReactModuleImport[] },
> = D["imports"] extends readonly ReactModuleImport[]
	? ExtractExportsFromImports<D["imports"]>
	: EmptyObject;

type ExtractImportsComponentExports<
	D extends { imports?: readonly ReactModuleImport[] },
> = D["imports"] extends readonly ReactModuleImport[]
	? ExtractComponentExportsFromImports<D["imports"]>
	: EmptyObject;

type ExtractModuleDefFromModule<T> = T extends {
	[reactImportModuleDefMarker]?: infer Def;
}
	? Def
	: (T extends { exports: infer E } ? { exports: E } : EmptyObject) &
			(T extends { componentExports: infer CE }
				? { componentExports: CE }
				: EmptyObject);

type ExtractExportsFromImports<T extends readonly ReactModuleImport[]> =
	T extends readonly [
		infer First,
		...infer Rest extends readonly ReactModuleImport[],
	]
		? ExtractModuleDefFromModule<First> extends { exports: infer E }
			? E & ExtractExportsFromImports<Rest>
			: ExtractExportsFromImports<Rest>
		: EmptyObject;

type ExtractComponentExportsFromImports<
	T extends readonly ReactModuleImport[],
> = T extends readonly [
	infer First,
	...infer Rest extends readonly ReactModuleImport[],
]
	? ExtractModuleDefFromModule<First> extends { componentExports: infer E }
		? WithoutDepsComponentMap<E> & ExtractComponentExportsFromImports<Rest>
		: ExtractComponentExportsFromImports<Rest>
	: EmptyObject;

type WithProviders<
	TProviders extends DefProviderMap | EmptyObject,
	TDeps extends object,
> = TProviders extends EmptyObject
	? {
			providers?: EmptyObject;
		}
	: {
			providers: ToReactProviderMap<TProviders, TDeps>;
		};

type ToReactProviderMap<
	T extends DefProviderMap,
	DepsMap extends object = Record<string, unknown>,
> = [keyof T] extends [never]
	? EmptyObject
	: {
			[K in keyof T]: T[K] extends object
				?
						| (Provider<
								T[K],
								KnownStringKeyMap<DepsMap>,
								NonScopedResolverOptions<T>
						  > & {
								initAfter?: readonly Extract<keyof DepsMap, string>[];
						  })
						| T[K]
				: T[K];
		};

export type NonScopedResolverOptions<T> = Omit<
	BuildResolverOptions<T>,
	"lifetime"
> & {
	lifetime?: Exclude<LifetimeType, "SCOPED">;
};

type KnownStringKeyMap<T extends object> = {
	[K in Extract<keyof T, string>]: T[K];
};

type WithImports<TImports extends readonly unknown[]> =
	TImports extends readonly []
		? { imports?: readonly [] }
		: { imports: TImports };

type WithExports<TKeys extends readonly string[]> = TKeys extends readonly []
	? { exports?: readonly [] }
	: { exports: TKeys };

type WithComponents<
	TComponents extends Record<string, ReactComponent> | EmptyObject,
> = TComponents extends EmptyObject
	? { components?: EmptyObject }
	: { components: TComponents };

type WithComponentExports<TKeys extends readonly string[]> =
	TKeys extends readonly []
		? { componentExports?: readonly [] }
		: { componentExports: TKeys };
