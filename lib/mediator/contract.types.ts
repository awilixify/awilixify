import type { EmptyObject } from "../di/common.types.js";
import type {
	Module,
	ModuleDefinition,
	ModuleImport,
} from "../di/modules/module.types.js";
import type { DefPreHandlerMap } from "../di/providers/provider.types.js";
import type {
	GlobalCommandPreHandlers,
	GlobalQueryPreHandlers,
	NormalizeGlobalPreHandlerMap,
} from "./global-middlewares.types.js";
import type { EmptyContext } from "./middleware.types.js";

// ============================================================================
// Module Shape Types
// ============================================================================

type QueryContractModuleDef = {
	queryPreHandlers?: DefPreHandlerMap;
	imports?: readonly ModuleImport[];
};

type EmptyModuleDef = Record<never, never>;

type CommandContractModuleDef = {
	commandPreHandlers?: DefPreHandlerMap;
	imports?: readonly ModuleImport[];
};

type ContractScenario<TPreHandlerKey extends string> = {
	name: string;
	includePreHandlerKeys?: readonly TPreHandlerKey[];
	excludePreHandlerKeys?: readonly TPreHandlerKey[];
};

// ============================================================================
// Local Pre-Handler Utility Types
// ============================================================================

type PreHandlerExportKey =
	| "queryPreHandlerExports"
	| "commandPreHandlerExports";

type ExtractModuleDef<T> =
	T extends Module<infer TDef extends ModuleDefinition>
		? TDef
		: T extends Record<string, unknown>
			? T
			: never;

type ExtractExportedPreHandlerMap<
	TModuleDef,
	TExportKey extends PreHandlerExportKey,
> = TModuleDef extends { [K in TExportKey]?: infer E }
	? [NonNullable<E>] extends [DefPreHandlerMap]
		? NonNullable<E>
		: EmptyObject
	: EmptyObject;

type ExtractPreHandlerMapFromImports<
	TImports extends readonly ModuleImport[] | undefined,
	TExportKey extends PreHandlerExportKey,
> = TImports extends readonly [
	infer First,
	...infer Rest extends readonly ModuleImport[],
]
	? ExtractExportedPreHandlerMap<ExtractModuleDef<First>, TExportKey> &
			ExtractPreHandlerMapFromImports<Rest, TExportKey>
	: EmptyObject;

type ExtractMiddlewareContract<M> = M extends {
	readonly contract: infer C;
}
	? C
	: M extends new (
				...args: any[]
			) => infer I
		? I extends { readonly contract: infer C }
			? C
			: never
		: M extends { useClass: infer U }
			? ExtractMiddlewareContract<U>
			: never;

type ExtractContextData<T> =
	T extends Result<infer Data, any>
		? Data extends Record<string, unknown>
			? Data
			: never
		: T extends Record<string, unknown>
			? T
			: never;

type ExtractContextFromMiddleware<M> =
	ExtractMiddlewareContract<M> extends { returnType: infer R }
		? ExtractContextData<R>
		: never;

type ExtractErrorFromMiddleware<M> =
	ExtractMiddlewareContract<M> extends { returnType: infer R }
		? ExtractResultError<R>
		: never;

// ============================================================================
// Public Contract Types
// ============================================================================

export type AnyContract = {
	key: string;
	payload: unknown;
	response: unknown;
	returnType?: unknown;
	context?: Record<string, unknown>;
	scenarios?: Record<string, unknown>;
};

export type QueryContract<
	K extends string,
	P,
	R,
	Scenarios extends ContractScenario<QueryPreHandlerKeys<M>> | never = never,
	M extends QueryContractModuleDef = EmptyModuleDef,
> = Contract<K, P, R> &
	WithScenario<
		QueryContractPreHandlerMap<M>,
		QueryPreHandlerKeys<M>,
		R,
		Scenarios
	> & {
		returnType: QueryContractReturnType<M, R>;
		context: ResolveQueryContractContext<M, Scenarios>;
	};

export type CommandContract<
	K extends string,
	P,
	R,
	Scenarios extends ContractScenario<CommandPreHandlerKeys<M>> | never = never,
	M extends CommandContractModuleDef = EmptyModuleDef,
> = Contract<K, P, R> & {
	returnType: CommandContractReturnType<M, R>;
	context: ResolveCommandContractContext<M, Scenarios>;
} & WithScenario<
		CommandContractPreHandlerMap<M>,
		CommandPreHandlerKeys<M>,
		R,
		Scenarios
	>;

// ============================================================================
// Pre-Handler Maps & Return Type Resolution
// ============================================================================

type QueryContractPreHandlerMap<M extends QueryContractModuleDef> = [
	M,
] extends [never]
	? NormalizeGlobalPreHandlerMap<GlobalQueryPreHandlers>
	: NonNullable<M["queryPreHandlers"]> &
			NormalizeGlobalPreHandlerMap<GlobalQueryPreHandlers> &
			ExtractPreHandlerMapFromImports<M["imports"], "queryPreHandlerExports">;

type CommandContractPreHandlerMap<M extends CommandContractModuleDef> = [
	M,
] extends [never]
	? NormalizeGlobalPreHandlerMap<GlobalCommandPreHandlers>
	: NonNullable<M["commandPreHandlers"]> &
			NormalizeGlobalPreHandlerMap<GlobalCommandPreHandlers> &
			ExtractPreHandlerMapFromImports<M["imports"], "commandPreHandlerExports">;

type QueryContractReturnType<
	M extends QueryContractModuleDef,
	R,
> = ResolveContractReturnTypeByModule<
	M,
	NormalizeGlobalPreHandlerMap<GlobalQueryPreHandlers>,
	QueryContractPreHandlerMap<M>,
	R
>;

type CommandContractReturnType<
	M extends CommandContractModuleDef,
	R,
> = ResolveContractReturnTypeByModule<
	M,
	NormalizeGlobalPreHandlerMap<GlobalCommandPreHandlers>,
	CommandContractPreHandlerMap<M>,
	R
>;

// ============================================================================
// Pre-Handler Key Extraction
// ============================================================================

type QueryPreHandlerKeys<M extends QueryContractModuleDef> = [M] extends [never]
	? Extract<keyof NormalizeGlobalPreHandlerMap<GlobalQueryPreHandlers>, string>
	:
			| Extract<keyof NonNullable<M["queryPreHandlers"]>, string>
			| Extract<
					keyof NormalizeGlobalPreHandlerMap<GlobalQueryPreHandlers>,
					string
			  >
			| Extract<
					keyof ExtractPreHandlerMapFromImports<
						M["imports"],
						"queryPreHandlerExports"
					>,
					string
			  >;

type CommandPreHandlerKeys<M extends CommandContractModuleDef> = [M] extends [
	never,
]
	? Extract<
			keyof NormalizeGlobalPreHandlerMap<GlobalCommandPreHandlers>,
			string
		>
	:
			| Extract<keyof NonNullable<M["commandPreHandlers"]>, string>
			| Extract<
					keyof NormalizeGlobalPreHandlerMap<GlobalCommandPreHandlers>,
					string
			  >
			| Extract<
					keyof ExtractPreHandlerMapFromImports<
						M["imports"],
						"commandPreHandlerExports"
					>,
					string
			  >;

// ============================================================================
// Scenario Extraction
// ============================================================================

type WithScenario<
	TPreHandlerMap,
	TPreHandlerKey extends string,
	R,
	Scenarios extends ContractScenario<TPreHandlerKey> | never,
> = [Scenarios] extends [never]
	? Record<never, never>
	: {
			scenarios: ResolveScenarioResponseMap<
				TPreHandlerMap,
				TPreHandlerKey,
				R,
				Scenarios
			>;
		};

// ============================================================================
// Scenario Map Selection
// ============================================================================

type ExtractIncludedPreHandlerMap<TMap, TAllKeys extends string, TScenario> =
	NormalizeScenarioWithDefaultInclude<TScenario, TAllKeys> extends {
		includePreHandlerKeys: infer Include extends readonly any[];
	}
		? Pick<TMap, Extract<Include[number], TAllKeys>>
		: TMap;

type NormalizeScenarioWithDefaultInclude<
	TScenario,
	TAllKeys extends string,
> = TScenario extends {
	includePreHandlerKeys: readonly any[];
}
	? TScenario
	: TScenario & {
			includePreHandlerKeys: readonly TAllKeys[];
		};

type ExtractScenarioPreHandlerMap<TMap, TAllKeys extends string, TScenario> =
	ExtractIncludedPreHandlerMap<
		TMap,
		TAllKeys,
		TScenario
	> extends infer TIncluded
		? TScenario extends {
				excludePreHandlerKeys: infer Exclude extends readonly any[];
			}
			? Omit<TIncluded, Extract<Exclude[number], keyof TIncluded>>
			: TIncluded
		: EmptyContext;

// ============================================================================
// Context Extraction
// ============================================================================

type ResolveScenarioContext<
	TPreHandlerMap,
	TPreHandlerKey extends string,
	Scenarios extends ContractScenario<TPreHandlerKey>,
> =
	Scenarios extends ContractScenario<TPreHandlerKey>
		? ResolveContextOrEmpty<
				ContextFromPreHandlerMap<
					ExtractScenarioPreHandlerMap<
						TPreHandlerMap,
						TPreHandlerKey,
						Scenarios
					>
				>
			>
		: never;

// ============================================================================
// Error Extraction & Response Merging
// ============================================================================

type ExtractPreHandlerErrorsFromMap<TMap> = [
	Extract<keyof TMap, string>,
] extends [never]
	? never
	: {
			[K in Extract<keyof TMap, string>]: ExtractErrorFromMiddleware<TMap[K]>;
		}[Extract<keyof TMap, string>];

type ResolveScenarioResponse<
	TPreHandlerMap,
	TPreHandlerKey extends string,
	R,
	Scenario extends ContractScenario<TPreHandlerKey>,
> = ResponseWithErrors<
	R,
	ExtractPreHandlerErrorsFromMap<
		ExtractScenarioPreHandlerMap<TPreHandlerMap, TPreHandlerKey, Scenario>
	>
>;

type ResolveContractReturnType<TPreHandlerErrors, R> =
	MergeResponseWithPreHandlerErrors<R, TPreHandlerErrors>;

// Keep global and full contract maps separate to preserve a fast default path:
// empty module defs resolve against global errors only, explicit module defs use full map.
type ResolveContractReturnTypeByModule<
	M,
	TGlobalPreHandlerMap,
	TContractPreHandlerMap,
	R,
> = [keyof M] extends [never]
	? ResolveContractReturnType<
			ExtractPreHandlerErrorsFromMap<TGlobalPreHandlerMap>,
			R
		>
	: ResolveContractReturnType<
			ExtractPreHandlerErrorsFromMap<TContractPreHandlerMap>,
			R
		>;

// ============================================================================
// Scenario Response Mapping
// ============================================================================

type ResolveScenarioResponseMap<
	TPreHandlerMap,
	TPreHandlerKey extends string,
	R,
	Scenarios extends ContractScenario<TPreHandlerKey>,
> = {
	[Scenario in Scenarios as Scenario["name"]]: {
		config: Omit<Scenario, "name">;
		returnType: ResolveScenarioResponse<
			TPreHandlerMap,
			TPreHandlerKey,
			R,
			Scenario
		>;
	};
};

// ============================================================================
// Base Contract Types
// ============================================================================

type ContextFromMiddlewareOrEmpty<TMiddleware> = [
	ExtractContextFromMiddleware<TMiddleware>,
] extends [never]
	? EmptyContext
	: ExtractContextFromMiddleware<TMiddleware>;

type ResolveContextOrEmpty<TContext> = [TContext] extends [
	Record<string, unknown>,
]
	? TContext
	: EmptyContext;

type ContextFromPreHandlerMap<TMap> =
	Extract<keyof TMap, string> extends never
		? EmptyContext
		: UnionToIntersection<
				{
					[K in Extract<keyof TMap, string>]: ContextFromMiddlewareOrEmpty<
						TMap[K]
					>;
				}[Extract<keyof TMap, string>]
			>;

type Contract<K extends string, P, R> = {
	key: K;
	payload: P;
	response: R;
};

// ============================================================================
// Contract Context Resolution
// ============================================================================

type ResolveQueryContractContext<
	M extends QueryContractModuleDef,
	Scenarios extends ContractScenario<QueryPreHandlerKeys<M>>,
> = [Scenarios] extends [never]
	? ResolveContextOrEmpty<
			ContextFromPreHandlerMap<QueryContractPreHandlerMap<M>>
		>
	: ResolveScenarioContext<
			QueryContractPreHandlerMap<M>,
			QueryPreHandlerKeys<M>,
			Scenarios
		>;

type ResolveCommandContractContext<
	M extends CommandContractModuleDef,
	Scenarios extends ContractScenario<CommandPreHandlerKeys<M>>,
> = [Scenarios] extends [never]
	? ResolveContextOrEmpty<
			ContextFromPreHandlerMap<CommandContractPreHandlerMap<M>>
		>
	: ResolveScenarioContext<
			CommandContractPreHandlerMap<M>,
			CommandPreHandlerKeys<M>,
			Scenarios
		>;

// ============================================================================
// Result Utilities
// ============================================================================

/**
 * Extract success type from Result
 */
type ExtractResultSuccess<R> = R extends {
	readonly ok: true;
	readonly value: infer T;
}
	? T
	: never;

/**
 * Extract error type from Result
 */
type ExtractResultError<R> = R extends {
	readonly ok: false;
	readonly error: infer E;
}
	? E
	: never;

/**
 * Check if type is a Result
 */
type IsResult<R> = R extends
	| { readonly ok: true; readonly value: any }
	| { readonly ok: false; readonly error: any }
	? true
	: false;

/**
 * Merge all middleware errors with handler response
 * If no middleware errors registered - return response as-is
 * If response is Result<S, E>, returns Result<S, E | UnauthorizedError | TenantNotFoundError | ...>
 * If response is plain type S, returns Result<S, UnauthorizedError | TenantNotFoundError | ...>
 */
type ResponseWithErrors<Response, Errors> = [Errors] extends [never]
	? Response
	: IsResult<Response> extends true
		? Result<
				ExtractResultSuccess<Response>,
				ExtractResultError<Response> | Errors
			>
		: Result<Response, Errors>;

/**
 * Generic Result type - structural match for Result pattern
 */
type Result<Value, Err> =
	| { readonly ok: true; readonly value: Value; readonly error: undefined }
	| { readonly ok: false; readonly value: undefined; readonly error: Err };

type MergeResponseWithPreHandlerErrors<TResponse, TPreHandlerError> = [
	TPreHandlerError,
] extends [never]
	? TResponse
	: [TResponse] extends [{ readonly ok: true; readonly value: infer V }]
		? Result<V, TPreHandlerError>
		: [TResponse] extends [{ readonly ok: false; readonly error: infer E }]
			? Result<never, E | TPreHandlerError>
			: [TResponse] extends [
						| { readonly ok: true; readonly value: infer V }
						| { readonly ok: false; readonly error: infer E },
					]
				? Result<V, E | TPreHandlerError>
				: Result<TResponse, TPreHandlerError>;

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
	k: infer I,
) => void
	? I
	: never;
