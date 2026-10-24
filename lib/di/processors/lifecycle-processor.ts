import * as Awilix from "awilix";
import * as ERRORS from "../errors.js";
import { InitHook, ShutdownHook } from "../lifecycle-hooks.js";
import type { InternalModuleLike as M } from "../modules/runtime-module.types.js";
import * as GUARGS from "../type-guards.js";
import type { InitializerTask } from "./initializer-processor.js";

type EagerProviderRef = {
	module: M;
	scope: Awilix.AwilixContainer;
	key: string;
};

type InitializedProviderRef = EagerProviderRef & {
	instance: unknown;
};

type EagerProviderNode = EagerProviderRef & {
	id: string;
	initAfter: string[];
};

export interface ModuleInitOptions {
	excludeInitializers?: true | readonly string[];
	excludeAfterInit?: true | readonly string[];
}

export interface LifecycleMethods {
	init(options?: ModuleInitOptions): Promise<void>;
	close(): Promise<void>;
	enableShutdownHooks(): void;
}

export class LifecycleProcessor {
	private readonly eagerProviderRefs: EagerProviderRef[] = [];
	private readonly initializerTasks: InitializerTask[] = [];
	private readonly createdScopes: Awilix.AwilixContainer[] = [];
	private initPromise?: Promise<void>;
	private closePromise?: Promise<void>;
	private readonly shutdownListeners = new Map<
		NodeJS.Signals,
		() => Promise<void>
	>();

	constructor(
		private readonly providerOptions: Partial<Awilix.BuildResolverOptions<any>>,
	) {}

	collectEagerProviders(m: M, scope: Awilix.AwilixContainer): void {
		for (const key of this.getEagerProviderKeys(m)) {
			this.eagerProviderRefs.push({
				module: m,
				scope,
				key,
			});
		}
	}

	trackScope(scope: Awilix.AwilixContainer): void {
		this.createdScopes.push(scope);
	}

	addInitializerTask(task: InitializerTask | null): void {
		if (!task) return;

		this.initializerTasks.push(task);
	}

	init(options?: ModuleInitOptions): Promise<void> {
		this.initPromise ??= this.executeInit(options);

		return this.initPromise;
	}

	close(): Promise<void> {
		this.closePromise ??= this.executeClose().finally(() => {
			for (const [signal, listener] of this.shutdownListeners) {
				process.off(signal, listener);
			}
			this.shutdownListeners.clear();
		});

		return this.closePromise;
	}

	enableShutdownHooks(): void {
		if (this.closePromise || this.shutdownListeners.size > 0) return;

		let shutdownSignalReceived = false;

		for (const signal of ["SIGINT", "SIGTERM"] as const) {
			const listener = async () => {
				// Ignore repeated signals while shutdown is in progress
				if (shutdownSignalReceived) return;
				shutdownSignalReceived = true;

				try {
					await this.close();
					// close() removes our signal listeners. Re-send the signal to trigger
					// default termination, even with open sockets, if **no other listeners** remain.
					// Any remaining custom listener receives this second signal instead,
					// so termination is not guaranteed. Do not mix with custom signal handlers.
					process.kill(process.pid, signal);
				} catch (error) {
					console.error("Application shutdown failed", error);
					process.exit(1);
				}
			};

			this.shutdownListeners.set(signal, listener);
			process.on(signal, listener);
		}
	}

	private async executeInit(options?: ModuleInitOptions): Promise<void> {
		const initializedProviders: InitializedProviderRef[] = [];

		for (const { module, scope, key } of this.sortEagerProviderRefs()) {
			const instance = await this.resolveEagerProvider({
				module,
				scope,
				key,
			});
			initializedProviders.push({ module, scope, key, instance });
			if (!GUARGS.hasProviderOnInit(instance)) continue;

			await instance[InitHook.OnInit]();
		}

		for (const initialize of this.initializerTasks) {
			await initialize(options);
		}

		for (const { key, instance } of initializedProviders) {
			if (this.shouldSkipProviderAfterInit(key, options)) continue;

			if (!GUARGS.hasProviderAfterInit(instance)) continue;

			await instance[InitHook.AfterInit]();
		}
	}

	private async executeClose(): Promise<void> {
		// Startup must settle before taking the shutdown provider snapshot.
		await this.initPromise?.catch(() => {});

		const errors: unknown[] = [];
		const providers = [
			...new Set(
				this.createdScopes.flatMap((scope) =>
					[...scope.cache.values()]
						.filter((el) => el.resolver.lifetime === Awilix.Lifetime.SINGLETON)
						.map(({ value }) => value),
				),
			),
		];

		for (const hook of Object.values(ShutdownHook)) {
			const results = await Promise.allSettled(
				providers
					.filter((instance) => GUARGS.hasProviderShutdownHook(instance, hook))
					.map(async (instance) => instance[hook]()),
			);

			for (const result of results) {
				if (result.status === "rejected") errors.push(result.reason);
			}
		}

		const uniqueScopes = Array.from(new Set(this.createdScopes)).reverse();

		for (const scope of uniqueScopes) {
			await scope.dispose().catch((error) => {
				errors.push(error);
			});
		}

		if (errors.length > 0) {
			throw new AggregateError(errors, "Application shutdown failed");
		}
	}

	private shouldSkipProviderAfterInit(
		key: string,
		options?: ModuleInitOptions,
	): boolean {
		if (options?.excludeAfterInit === true) return true;
		if (!Array.isArray(options?.excludeAfterInit)) return false;

		return new Set(options.excludeAfterInit).has(key);
	}

	private getEagerProviderKeys(m: M): string[] {
		return Object.entries(m.providers || {})
			.filter(([, provider]) => GUARGS.isEagerProvider(provider))
			.map(([key]) => key);
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
		const { eager, initAfter, inject, useFactory, ...providerResolverOptions } =
			provider;
		const resolverOptions: Awilix.BuildResolverOptions<any> = {
			...this.providerOptions,
			...module.providerOptions,
			...providerResolverOptions,
		};

		scope.register({
			[key]: Awilix.asFunction(() => resolvedValue, resolverOptions),
		});

		return scope.resolve(key);
	}

	private sortEagerProviderRefs(): EagerProviderRef[] {
		const nodes = this.eagerProviderRefs.map((ref) => ({
			...ref,
			id: `${ref.module.name}:${ref.key}`,
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
}
