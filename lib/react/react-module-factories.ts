import type { Module, ModuleDefinition } from "./react-module.types.js";

export type ModuleOptions = {
	hashNameFrom?: unknown;
	hashLength?: number;
};

export function createModule<TDef extends ModuleDefinition>(
	module: Module<TDef>,
	options?: ModuleOptions,
): Module<TDef> {
	if (options?.hashNameFrom === undefined) {
		return module;
	}

	const hash = hashString(stableStringify(options.hashNameFrom)).slice(
		0,
		Math.max(4, options.hashLength ?? 8),
	);

	return {
		...module,
		name: `${module.name}_${hash}`,
	};
}

function hashString(value: string): string {
	let hash = 5381;

	for (let index = 0; index < value.length; index += 1) {
		hash = (hash * 33) ^ value.charCodeAt(index);
	}

	return (hash >>> 0).toString(16).padStart(8, "0");
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
