import * as Awilix from "awilix";
import * as ERRORS from "../errors.js";
import type { InternalModuleLike as M } from "../modules/runtime-module.types.js";
import * as GUARGS from "../type-guards.js";
import type { InitializerTask } from "./initializer-processor.js";

type EagerProviderRef = {
	module: M;
	scope: Awilix.AwilixContainer;
	key: string;
};

type EagerProviderNode = EagerProviderRef & {
	id: string;
	initAfter: string[];
};

export class LifecycleProcessor {
	private readonly eagerProviderRefs: EagerProviderRef[] = [];
	private readonly initializerTasks: InitializerTask[] = [];
	private initPromise?: Promise<void>;

	collectEagerProviders(m: M, scope: Awilix.AwilixContainer): void {
		for (const key of this.getEagerProviderKeys(m)) {
			this.eagerProviderRefs.push({
				module: m,
				scope,
				key,
			});
		}
	}

	addInitializerTasks(tasks: InitializerTask[]): void {
		this.initializerTasks.push(...tasks);
	}

	init(): Promise<void> {
		this.initPromise ??= this.executeInit();

		return this.initPromise;
	}

	private async executeInit(): Promise<void> {
		for (const { module, scope, key } of this.sortEagerProviderRefs()) {
			this.ensureEagerProviderUsesSingletonLifetime(module, scope, key);
			const instance = await this.resolveEagerProvider({
				module,
				scope,
				key,
			});
			await this.callProviderInitAsync(instance);
		}

		for (const initialize of this.initializerTasks) {
			await initialize();
		}
	}

	private getEagerProviderKeys(m: M): string[] {
		return Object.entries(m.providers || {})
			.filter(([, provider]) => GUARGS.isEagerProvider(provider))
			.map(([key]) => key);
	}

	private ensureEagerProviderUsesSingletonLifetime(
		m: M,
		scope: Awilix.AwilixContainer,
		key: string,
	): void {
		if (scope.registrations[key]?.lifetime !== Awilix.Lifetime.SINGLETON) {
			throw new ERRORS.EagerProviderRequiresSingletonLifetimeError(m.name, key);
		}
	}

	private async resolveEagerProvider({
		module,
		scope,
		key,
	}: EagerProviderRef): Promise<unknown> {
		const provider = module.providers?.[key];

		if (
			!provider ||
			!GUARGS.isFactoryProvider(provider) ||
			!GUARGS.isAsyncFactoryProvider(provider)
		) {
			return scope.resolve(key);
		}

		const factoryDeps = (provider.inject || []).map((dependencyKey) =>
			// biome-ignore lint/style/noNonNullAssertion: dependencies are validated by ProviderDependencySorter
			scope.registrations[dependencyKey]!.resolve(scope),
		);
		const resolvedValue = await provider.useFactory(...factoryDeps);

		scope.register({
			[key]: Awilix.asValue(resolvedValue),
		});

		return resolvedValue;
	}

	private async callProviderInitAsync(instance: unknown): Promise<void> {
		if (!GUARGS.hasProviderInit(instance)) return;

		await instance.init();
	}

	private sortEagerProviderRefs(): EagerProviderRef[] {
		const nodes = this.eagerProviderRefs.map((ref) => ({
			...ref,
			id: LifecycleProcessor.createEagerProviderId(ref.module.name, ref.key),
			initAfter: this.getProviderInitAfter(ref.module, ref.key),
		}));
		const nodeById = new Map(nodes.map((node) => [node.id, node]));
		const nodeByKey = LifecycleProcessor.buildEagerProviderNodeKeyMap(nodes);
		const graph = new Map<string, string[]>(nodes.map((node) => [node.id, []]));
		const inDegree = new Map<string, number>(nodes.map((node) => [node.id, 0]));

		for (const node of nodes) {
			for (const dependencyKey of node.initAfter) {
				const dependencyNode = nodeByKey.get(dependencyKey);

				if (!dependencyNode) {
					throw new ERRORS.EagerProviderInitDependencyNotFoundError(
						node.module.name,
						node.key,
						dependencyKey,
					);
				}

				const dependencies = graph.get(dependencyNode.id);
				if (!dependencies) continue;
				dependencies.push(node.id);
				inDegree.set(node.id, (inDegree.get(node.id) || 0) + 1);
			}
		}

		const sortedIds = this.sortEagerProviderIds(graph, inDegree);

		if (sortedIds.length !== nodes.length) {
			throw new ERRORS.CircularProviderInitDependencyError(
				nodes.map((node) => node.key),
			);
		}

		return sortedIds.map((id) => {
			// biome-ignore lint/style/noNonNullAssertion: ids come from nodeById keys
			const { module, scope, key } = nodeById.get(id)!;
			return { module, scope, key };
		});
	}

	private getProviderInitAfter(module: M, key: string): string[] {
		const provider = module.providers?.[key];

		if (!GUARGS.hasInitAfter(provider)) return [];

		return [...provider.initAfter];
	}

	private sortEagerProviderIds(
		graph: Map<string, string[]>,
		inDegree: Map<string, number>,
	): string[] {
		const queue = Array.from(inDegree.entries())
			.filter(([, degree]) => degree === 0)
			.map(([id]) => id);
		const sortedIds: string[] = [];

		while (queue.length > 0) {
			// biome-ignore lint/style/noNonNullAssertion: queue length was checked
			const current = queue.shift()!;
			sortedIds.push(current);

			for (const dependent of graph.get(current) || []) {
				const nextDegree = (inDegree.get(dependent) || 0) - 1;
				inDegree.set(dependent, nextDegree);
				if (nextDegree === 0) queue.push(dependent);
			}
		}

		return sortedIds;
	}

	private static buildEagerProviderNodeKeyMap(
		nodes: EagerProviderNode[],
	): Map<string, EagerProviderNode> {
		const nodeByKey = new Map<string, EagerProviderNode>();

		for (const node of nodes) {
			nodeByKey.set(node.key, node);
		}

		return nodeByKey;
	}

	private static createEagerProviderId(
		moduleName: string,
		key: string,
	): string {
		return `${moduleName}:${key}`;
	}
}
