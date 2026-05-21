import type { BuildResolverOptions, Constructor } from "awilix";
import type { EmptyObject } from "../common.types.js";
import type { RawValueObject } from "../modules/module.types.js";
import type { InternalModuleLike } from "../modules/runtime-module.types.js";
import type {
	AnyInitializer,
	AnyInterceptor,
	DefInitializerMap,
	DefInterceptorMap,
	DefPreHandlerMap,
	DefProviderMap,
	Provider,
} from "../providers/provider.types.js";

type OwnProviderMap<TModule> = TModule extends {
	providers: infer TProviders extends DefProviderMap;
}
	? TProviders
	: EmptyObject;

type OwnQueryPreHandlerMap<TModule> = TModule extends {
	queryPreHandlers: infer TPreHandlers extends DefPreHandlerMap;
}
	? TPreHandlers
	: EmptyObject;

type OwnCommandPreHandlerMap<TModule> = TModule extends {
	commandPreHandlers: infer TPreHandlers extends DefPreHandlerMap;
}
	? TPreHandlers
	: EmptyObject;

type OwnInterceptorMap<TModule> = TModule extends {
	interceptors: infer TInterceptors extends DefInterceptorMap;
}
	? TInterceptors
	: EmptyObject;

type OwnInitializerMap<TModule> = TModule extends {
	initializers: infer TInitializers extends DefInitializerMap;
}
	? TInitializers
	: EmptyObject;

type ModuleDeps<TModule> = TModule extends {
	deps: infer TDeps extends Record<string, unknown>;
}
	? TDeps
	: Record<string, unknown>;

type RuntimeProviderValue<T> = T extends {
	useFactory: (...args: any[]) => infer R;
}
	? Awaited<R>
	: T extends { useClass: infer C extends new (...args: any[]) => any }
		? InstanceType<C>
		: T extends new (
					...args: any[]
				) => infer I
			? I
			: T;

// Overrides are checked against the public injectable contract. Private and
// protected members are implementation details, and separately declared test
// doubles cannot be nominally compatible with them unless they extend the
// original class.
type PublicShape<T> = Pick<T, keyof T>;

type ProviderOverride<TValue, TDeps extends Record<string, unknown>> =
	RuntimeProviderValue<TValue> extends object
		?
				| (Provider<PublicShape<RuntimeProviderValue<TValue>>, TDeps> & {
						initAfter?: readonly Extract<keyof TDeps, string>[];
				  })
				| RawValueObject<PublicShape<RuntimeProviderValue<TValue>>>
		: RuntimeProviderValue<TValue>;

type ProviderOverridesFor<TModule> = {
	[K in Extract<keyof OwnProviderMap<TModule>, string>]?: ProviderOverride<
		OwnProviderMap<TModule>[K],
		ModuleDeps<TModule>
	>;
};

type MiddlewareOverride<TValue> = TValue extends object
	?
			| Constructor<PublicShape<RuntimeProviderValue<TValue>>>
			| ({
					useClass: Constructor<PublicShape<RuntimeProviderValue<TValue>>>;
			  } & BuildResolverOptions<any>)
	: RuntimeProviderValue<TValue> extends object
		? never
		: RuntimeProviderValue<TValue>;

type PreHandlerOverridesFor<TMap> = {
	[K in Extract<keyof TMap, string>]?: MiddlewareOverride<TMap[K]>;
};

type InterceptorOverridesFor<TModule> = {
	[K in Extract<keyof OwnInterceptorMap<TModule>, string>]?: AnyInterceptor;
};

type InitializerOverridesFor<TModule> = {
	[K in Extract<keyof OwnInitializerMap<TModule>, string>]?: AnyInitializer;
};

export type ModuleFeatureOverridesFor<TModule> = {
	providers?: ProviderOverridesFor<TModule>;
	queryPreHandlers?: PreHandlerOverridesFor<OwnQueryPreHandlerMap<TModule>>;
	commandPreHandlers?: PreHandlerOverridesFor<OwnCommandPreHandlerMap<TModule>>;
	interceptors?: InterceptorOverridesFor<TModule>;
	initializers?: InitializerOverridesFor<TModule>;
};

export type ModuleOverride<
	TModule extends InternalModuleLike = InternalModuleLike,
> = {
	module: TModule;
	overrides: ModuleFeatureOverridesFor<TModule>;
};

export type AnyModuleOverride = {
	module: InternalModuleLike;
	overrides: {
		providers?: Record<string, unknown>;
		queryPreHandlers?: Record<string, unknown>;
		commandPreHandlers?: Record<string, unknown>;
		interceptors?: Record<string, unknown>;
		initializers?: Record<string, unknown>;
	};
};

export function overrideModule<TModule extends InternalModuleLike>(
	module: TModule,
	overrides: ModuleFeatureOverridesFor<TModule>,
): ModuleOverride<TModule> {
	return { module, overrides };
}
