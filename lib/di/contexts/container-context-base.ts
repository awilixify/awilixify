import * as Awilix from "awilix";
import * as ERRORS from "../errors.js";
import type { InternalModuleLike as M } from "../modules/runtime-module.types.js";
import {
	type LifecycleMethods,
	LifecycleProcessor,
} from "../processors/lifecycle-processor.js";
import {
	type OverrideOptions,
	OverridesProcessor,
} from "../processors/overrides-processor.js";
import { ProviderDependencySorter } from "../providers/provider-dependency-sorter.js";
import type { ProviderResolver } from "../providers/provider-resolver.js";
import * as GUARGS from "../type-guards.js";
import { ModuleGraphEnsurer } from "./module-graph-ensurer.js";

interface ScopeContext {
	hasScopeContext: () => boolean;
	resolveFromScope: <T>(
		scope: Awilix.AwilixContainer,
		key: string | symbol,
	) => T;
}

export interface ContainerContextOptions<
	Options extends
		Awilix.BuildResolverOptions<any> = Awilix.BuildResolverOptions<any>,
> extends OverrideOptions {
	containerOptions?: Awilix.ContainerOptions;
	providerOptions?: Options;
	globalModules?: readonly M[];
}

export interface ModuleScope<
	S extends Awilix.AwilixContainer = Awilix.AwilixContainer,
> extends LifecycleMethods {
	name: string;
	scope: S;
	importedScopes: Map<string, ModuleScope>;
}

export type RegisteredModuleScope = {
	module: M;
	moduleScope: ModuleScope;
};

export abstract class ContainerContextBase<
	TOptions extends ContainerContextOptions = ContainerContextOptions,
> {
	protected readonly forwardRefModules = new WeakSet<M>();
	protected readonly moduleScopeMap = new WeakMap<M, Awilix.AwilixContainer>();
	protected readonly moduleTreeMap = new WeakMap<M, ModuleScope>();
	protected readonly options: TOptions;

	protected readonly sorter = new ProviderDependencySorter();
	protected readonly moduleGraphEnsurer = new ModuleGraphEnsurer();
	protected readonly lifecycleProcessor: LifecycleProcessor;
	protected readonly overridesProcessor: OverridesProcessor<M>;
	protected providerResolver: ProviderResolver;

	protected globalModulesWithScope: RegisteredModuleScope[] = [];

	protected constructor(
		options: TOptions,
		private readonly scopeContext?: ScopeContext,
	) {
		this.options = {
			...options,
			containerOptions: {
				strict: true,
				injectionMode: Awilix.InjectionMode.CLASSIC,
				...options.containerOptions,
			},
			providerOptions: {
				lifetime: Awilix.Lifetime.SINGLETON,
				...options.providerOptions,
			},
		};

		this.overridesProcessor = new OverridesProcessor({
			moduleOverrides: this.options.moduleOverrides,
		});
		this.lifecycleProcessor = new LifecycleProcessor(
			this.options.providerOptions || {},
		);
	}

	protected bootstrapModule(module: M): ModuleScope {
		this.initializeGlobalModules();

		const moduleTree = this.registerModuleWithScope(
			module,
			this.createContainer(module),
			[],
		);
		this.overridesProcessor.ensureAllModuleOverridesApplied();

		return moduleTree;
	}

	protected createContainer(module?: M): Awilix.AwilixContainer {
		const scope = Awilix.createContainer({
			...this.options.containerOptions,
			...module?.containerOptions,
		});
		this.lifecycleProcessor.trackScope(scope);

		return scope;
	}

	protected registerModuleWithScope(
		m: M,
		scope: Awilix.AwilixContainer,
		moduleChain: M[],
	): ModuleScope {
		const existingTree = this.moduleTreeMap.get(m);

		if (existingTree) {
			return existingTree;
		}

		const imports = this.resolveImports(m);
		const moduleWithOverrides = this.overridesProcessor.applyModuleOverrides(m);

		this.moduleGraphEnsurer.ensureImportedModulesUniqueness({
			module: moduleWithOverrides,
			resolvedImports: imports,
			globalModules: this.globalModulesWithScope.map((el) => el.module),
		});
		this.moduleGraphEnsurer.ensureNoProviderNameConflicts({
			module: moduleWithOverrides,
			resolvedImports: imports,
			globalModules: this.globalModulesWithScope.map((el) => el.module),
			getExportedProviderKeys: (module) => this.getExportedProviderKeys(module),
		});
		this.ensureAdditionalNameConflicts(moduleWithOverrides, imports);
		this.markModuleIfImportsUseForwardRef(moduleWithOverrides);

		const isCircular = moduleChain.includes(m);

		if (isCircular) {
			this.moduleGraphEnsurer.ensureCircularDependencyHasForwardRef({
				module: m,
				moduleChain,
				forwardRefModules: this.forwardRefModules,
			});

			return this.createModuleScope(
				m.name,
				// biome-ignore lint/style/noNonNullAssertion: circular module was already registered
				this.moduleScopeMap.get(m)!,
				[],
			);
		}

		this.moduleScopeMap.set(m, scope);

		const importedModulesWithScope = [
			...this.globalModulesWithScope,
			...imports.map((module) => {
				const moduleTree = this.registerModuleWithScope(
					module,
					this.createContainer(module),
					[...moduleChain, m],
				);

				return {
					module: this.overridesProcessor.getModuleWithOverrides(module),
					moduleScope: moduleTree,
				};
			}),
		];

		this.registerImportedFeatures(scope, importedModulesWithScope);

		const moduleForSorting: M = {
			...moduleWithOverrides,
			imports: importedModulesWithScope.map((el) => el.module),
		};

		this.beforeRegisterProviders(
			moduleWithOverrides,
			scope,
			importedModulesWithScope,
		);

		for (const [key, provider] of Object.entries(
			this.sorter.sortByDependencies(moduleForSorting),
		)) {
			scope.register({
				[key]: this.providerResolver.resolveProvider({
					key,
					provider,
					resolutionScope: scope,
					module: moduleWithOverrides,
				}),
			});
		}

		this.lifecycleProcessor.collectEagerProviders(moduleWithOverrides, scope);

		this.afterRegisterProviders(
			moduleWithOverrides,
			scope,
			importedModulesWithScope,
		);

		const moduleTree = this.createModuleScope(
			m.name,
			scope,
			importedModulesWithScope,
		);
		this.moduleTreeMap.set(m, moduleTree);

		return moduleTree;
	}

	protected initializeGlobalModules(): void {
		const globalModules = this.options.globalModules || [];
		const globalModuleImports = globalModules.flatMap((module) =>
			this.resolveImports(module).map((importedModule) => ({
				module,
				importedModule,
			})),
		);
		this.moduleGraphEnsurer.ensureGlobalModulesDoNotImportGlobalModules({
			globalModules,
			globalModuleImports,
		});

		this.globalModulesWithScope = [];

		for (const module of globalModules) {
			const moduleTree = this.registerModuleWithScope(
				module,
				this.createContainer(module),
				[],
			);
			this.globalModulesWithScope.push({
				module: this.overridesProcessor.getModuleWithOverrides(module),
				moduleScope: moduleTree,
			});
		}
	}

	protected registerImportedFeatures(
		scope: Awilix.AwilixContainer,
		importedModulesWithScope: RegisteredModuleScope[],
	): void {
		this.registerExportedProviders(scope, importedModulesWithScope);
	}

	protected registerExportedProviders(
		scope: Awilix.AwilixContainer,
		importedModulesWithScope: RegisteredModuleScope[],
	): void {
		for (const {
			module: importedModule,
			moduleScope: importedModuleScope,
		} of importedModulesWithScope) {
			for (const key of this.getExportedProviderKeys(importedModule)) {
				if (!importedModule.providers?.[key]) {
					throw new ERRORS.InvalidProviderDefinitionError(
						importedModule.name,
						key,
					);
				}

				scope.register({
					[key]: Awilix.asFunction(
						() => {
							const registration =
								// biome-ignore lint/style/noNonNullAssertion: provider must be registered
								importedModuleScope.scope.registrations[key]!;

							return registration.lifetime === Awilix.Lifetime.SINGLETON
								? importedModuleScope.scope.resolve(key)
								: this.scopeContext?.hasScopeContext()
									? this.scopeContext.resolveFromScope(
											importedModuleScope.scope,
											key,
										)
									: importedModuleScope.scope.resolve(key);
						},
						{
							lifetime: Awilix.Lifetime.TRANSIENT,
							isLeakSafe: true,
						},
					),
				});
			}
		}
	}

	protected getExportedProviderKeys(module: M): string[] {
		return module.exports ? [...module.exports] : [];
	}

	protected markModuleIfImportsUseForwardRef(m: M): void {
		if ((m.imports || []).some(GUARGS.isForwardRef)) {
			this.forwardRefModules.add(m);
		}
	}

	protected createModuleScope(
		name: string,
		scope: Awilix.AwilixContainer,
		importedModulesWithScope: RegisteredModuleScope[],
	): ModuleScope {
		const importedScopes = importedModulesWithScope.reduce(
			(acc, { moduleScope }) => {
				acc.set(moduleScope.name, moduleScope);

				return acc;
			},
			new Map(),
		);

		return {
			name,
			scope,
			importedScopes,
			init: (options) => this.lifecycleProcessor.init(options),
			dispose: () => this.lifecycleProcessor.dispose(),
		};
	}

	protected resolveImports(m: M): M[] {
		return (m.imports || []).map((importItem) => {
			const resolvedImport = GUARGS.isForwardRef(importItem)
				? importItem.resolve()
				: importItem;

			if (GUARGS.isPromiseLike(resolvedImport)) {
				throw new ERRORS.AsyncModuleRequiresAsyncCreateError(m.name);
			}

			return resolvedImport;
		});
	}

	protected ensureAdditionalNameConflicts(
		_module: M,
		_resolvedImports: M[],
	): void {}

	protected beforeRegisterProviders(
		_module: M,
		_scope: Awilix.AwilixContainer,
		_importedModulesWithScope: RegisteredModuleScope[],
	): void {}

	protected afterRegisterProviders(
		_module: M,
		_scope: Awilix.AwilixContainer,
		_importedModulesWithScope: RegisteredModuleScope[],
	): void {}
}
