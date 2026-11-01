import type {
	AnyModule,
	ImportModule,
	ModuleDefinition,
	ModuleImport,
} from "./module.types.js";
import type { ExtractExportsFromImports } from "./module-def.types.js";
import type { InternalModuleLike } from "./runtime-module.types.js";

export const configuredModuleSymbolKey = Symbol("awilixify.configureModule");

type Definition<M> =
	M extends ImportModule<infer Def extends ModuleDefinition>
		? Def
		: ModuleDefinition;

export type ConfiguredModule<M extends AnyModule> = InternalModuleLike &
	ImportModule<Definition<M>> & {
		readonly [configuredModuleSymbolKey]: {
			imports: readonly ModuleImport[];
			inject: readonly string[];
			useFactory: (...args: any[]) => M;
		};
	};

let nextId = 0;

/** Creates a module synchronously during DIContext.create(), before lifecycle hooks. */
export function configureModule<
	const Imports extends readonly ModuleImport[],
	const Keys extends readonly Extract<
		keyof ExtractExportsFromImports<Imports>,
		string
	>[],
	M extends AnyModule,
>(options: {
	imports: Imports;
	inject: Keys;
	useFactory: (
		...args: { [K in keyof Keys]: ExtractExportsFromImports<Imports>[Keys[K]] }
	) => M;
}): ConfiguredModule<M> {
	return {
		name: `ConfiguredModule_${++nextId}`,
		[configuredModuleSymbolKey]: options,
	};
}

export function isConfiguredModule(
	module: InternalModuleLike,
): module is ConfiguredModule<AnyModule> {
	return configuredModuleSymbolKey in module;
}
