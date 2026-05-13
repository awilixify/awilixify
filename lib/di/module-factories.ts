import { createHash } from "node:crypto";
import type { AnyModule, Module, ModuleDefinition } from "./module.types.js";
import type { ForwardRef } from "./module-ref.types.js";
import type { FactoryProvider } from "./provider.types.js";

export type ModuleOptions = {
	hashNameFrom?: unknown;
	hashLength?: number;
	registerControllers?: boolean;
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

export function createModule<TDef extends ModuleDefinition>(
	module: Module<TDef>,
	options?: ModuleOptions,
): Module<TDef> {
	const withOptions = {
		...module,
		registerControllers: options?.registerControllers ?? true,
	} as Module<TDef>;

	if (options?.hashNameFrom === undefined) {
		return withOptions;
	}

	const hash = createHash("sha256")
		.update(stableStringify(options.hashNameFrom))
		.digest("hex")
		.slice(0, Math.max(4, options.hashLength ?? 8));

	return {
		...withOptions,
		name: `${withOptions.name}_${hash}`,
	};
}

function stableStringify(value: unknown): string {
	return JSON.stringify(sortRecursively(value));
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
