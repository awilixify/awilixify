import * as ERRORS from "../errors.js";
import type { InternalModuleLike as M } from "../modules/runtime-module.types.js";
import {
	isFactoryProvider,
	isForwardRef,
	isPromiseLike,
} from "../type-guards.js";

type ProviderDepsGraph = {
	graph: Map<string, string[]>;
	inDegree: Map<string, number>;
};

export class ProviderDependencySorter {
	sortByDependencies(m: M): NonNullable<typeof m.providers> {
		const depsGraph = this.buildDepGraph(m, this.initializeDepGraph(m));
		const initialQueue = this.initializeQueue(depsGraph.inDegree);

		const sortedKeys = this.sortTopologically(depsGraph, initialQueue);

		this.ensureNoCyclicDependencies(m, sortedKeys);

		return sortedKeys.reduce<NonNullable<typeof m.providers>>((acc, key) => {
			const provider = m.providers?.[key];
			// Provider might be boolean. That's why not only undefined check
			if (provider !== undefined) acc[key] = provider;

			return acc;
		}, {});
	}

	private initializeDepGraph(m: M): ProviderDepsGraph {
		return Object.keys(m.providers || {}).reduce<ProviderDepsGraph>(
			(acc, curr) => {
				acc.graph.set(curr, []);
				acc.inDegree.set(curr, 0);

				return acc;
			},
			{
				graph: new Map(),
				inDegree: new Map(),
			},
		);
	}

	private buildDepGraph(m: M, depsGraph: ProviderDepsGraph): ProviderDepsGraph {
		const importedProviderKeys = new Set(
			(m.imports || []).flatMap((importItem) => {
				const importedModule = isForwardRef(importItem)
					? importItem.resolve()
					: importItem;
				if (isPromiseLike(importedModule)) {
					throw new Error(
						`Async module import in "${m.name}" was not resolved before provider dependency sorting.`,
					);
				}

				return importedModule.exports ? [...importedModule.exports] : [];
			}),
		);

		return Object.entries(m.providers || {}).reduce<ProviderDepsGraph>(
			(acc, [key, provider]) => {
				if (!isFactoryProvider(provider) || !provider.inject) return acc;

				provider.inject.forEach((dep) => {
					const depList = acc.graph.get(dep);

					if (depList) {
						depList.push(key);
						acc.inDegree.set(key, (acc.inDegree.get(key) || 0) + 1);

						return;
					}

					if (!depList && !importedProviderKeys.has(dep)) {
						throw new ERRORS.DependencyNotFoundError(dep, m.name);
					}
				});

				return acc;
			},
			{ ...depsGraph },
		);
	}

	private sortTopologically(
		depsGraph: ProviderDepsGraph,
		queue: string[],
		result: string[] = [],
	): string[] {
		const [current, ...restQueue] = queue;

		if (!current) return result;

		const deps = depsGraph.graph.get(current) || [];

		const inDegree = deps.reduce((acc, curr) => {
			acc.set(curr, (acc.get(curr) || 0) - 1);

			return acc;
		}, new Map(depsGraph.inDegree));

		return this.sortTopologically(
			{ ...depsGraph, inDegree },
			[...restQueue, ...deps.filter((dep) => inDegree.get(dep) === 0)],
			[...result, current],
		);
	}

	private initializeQueue(inDegree: ProviderDepsGraph["inDegree"]): string[] {
		return Array.from(inDegree.entries())
			.filter(([_, degree]) => degree === 0)
			.map(([key]) => key);
	}

	private ensureNoCyclicDependencies(m: M, sortedKeys: string[]) {
		const providerKeys = Object.keys(m.providers || {});

		if (sortedKeys.length !== providerKeys.length) {
			const remaining = providerKeys.filter((key) => !sortedKeys.includes(key));

			throw new ERRORS.CircularDependencyError(m.name, remaining);
		}
	}
}
