import type { EmptyObject } from "../common.types.js";
import type {
	Module,
	ModuleDefinition,
	RawValueObject,
} from "../modules/module.types.js";
import type {
	AnyProvider,
	DefProviderMap,
	Provider,
} from "../providers/provider.types.js";

type ModuleDefFrom<TModule> =
	TModule extends Module<infer TDef extends ModuleDefinition> ? TDef : never;

type OwnProviderMap<TModule> =
	ModuleDefFrom<TModule> extends {
		providers: infer TProviders extends DefProviderMap;
	}
		? TProviders
		: EmptyObject;

type ModuleDeps<TModule> =
	ModuleDefFrom<TModule> extends {
		deps: infer TDeps extends Record<string, unknown>;
	}
		? TDeps
		: Record<string, unknown>;

// Overrides are checked against the public injectable contract. Private and
// protected members are implementation details, and separately declared test
// doubles cannot be nominally compatible with them unless they extend the
// original class.
type PublicShape<T> = Pick<T, keyof T>;

type ProviderOverride<
	TValue,
	TDeps extends Record<string, unknown>,
> = TValue extends object
	?
			| (Provider<PublicShape<TValue>, TDeps> & {
					initAfter?: readonly Extract<keyof TDeps, string>[];
			  })
			| RawValueObject<PublicShape<TValue>>
	: TValue;

export type ProviderOverridesFor<TModule> = {
	[K in Extract<keyof OwnProviderMap<TModule>, string>]?: ProviderOverride<
		OwnProviderMap<TModule>[K],
		ModuleDeps<TModule>
	>;
};

export type AnyProviderOverrides = Record<string, AnyProvider>;
