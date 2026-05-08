import { createHash } from "node:crypto";
import type {
	AnyModule,
	DynamicModule,
	DynamicModuleDef,
	DynamicModuleOptions,
	StaticModule,
	StaticModuleDef,
} from "./module.types.js";
import type { ForwardRef } from "./module-ref.types.js";
import type { FactoryProvider } from "./provider.types.js";

type StripDynamic<T> = T extends { forRootConfig: any }
	? Omit<T, "forRootConfig">
	: T;

export type CreateStaticModuleOptions = {
	hashNameFrom?: unknown;
	hashLength?: number;
};

export function forwardRef<T extends AnyModule>(
	getter: () => T,
): ForwardRef<T> {
	return {
		__forward_ref__: true,
		resolve: getter,
	};
}

export function createFactoryProvider<DepsMap extends Record<string, any>>() {
	return <T extends object, const Keys extends readonly (keyof DepsMap)[]>(
		provider: FactoryProvider<T, DepsMap, Keys>,
	): FactoryProvider<T, DepsMap, Keys> => {
		return provider;
	};
}

export function createStaticModule<TDef extends StaticModuleDef>(
	module: StaticModule<StripDynamic<TDef>>,
	options?: CreateStaticModuleOptions,
): StaticModule<StripDynamic<TDef>> {
	const hashNameFrom = options?.hashNameFrom;

	// TODO: simplify
	if (hashNameFrom !== undefined) {
		const rawModule: any = module;
		const hashLength = options?.hashLength ?? 8;
		const hash = createHash("sha256")
			.update(stableStringify(hashNameFrom))
			.digest("hex")
			.slice(0, Math.max(4, hashLength));
		const moduleName = getModuleName(rawModule);

		const hashedModule = Object.assign({}, rawModule, {
			name: `${moduleName}_${hash}`,
		}) as unknown as StaticModule<StripDynamic<TDef>>;

		return hashedModule;
	}

	return module as unknown as StaticModule<StripDynamic<TDef>>;
}

export function createDynamicModule<TDef extends DynamicModuleDef>(
	factory: (
		config: TDef["forRootConfig"],
		options?: DynamicModuleOptions,
	) => StaticModule<TDef>,
): DynamicModule<TDef> {
	return {
		forRoot(config, options) {
			const builtModule = factory(config, options) as unknown as Record<
				string,
				unknown
			>;
			const dynamicModule = Object.assign({}, builtModule, {
				registerControllers: options?.registerControllers ?? false,
			}) as unknown as StaticModule<TDef>;

			return dynamicModule;
		},
	};
}

function stableStringify(value: unknown): string {
	return JSON.stringify(sortRecursively(value));
}

function getModuleName(module: unknown): string {
	return String((module as { name?: unknown }).name);
}

function sortRecursively(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(sortRecursively);
	}

	if (value && typeof value === "object") {
		return Object.keys(value as Record<string, unknown>)
			.sort()
			.reduce<Record<string, unknown>>((acc, key) => {
				acc[key] = sortRecursively((value as Record<string, unknown>)[key]);

				return acc;
			}, {});
	}

	return value;
}
