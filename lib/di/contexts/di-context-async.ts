import type * as Awilix from "awilix";
import type { InternalModuleLike as M } from "../modules/runtime-module.types.js";
import * as GUARGS from "../type-guards.js";
import type { DiContextOptions, ModuleScopeTree } from "./di-context-base.js";
import {
	DIContextBase,
	type DiContextCreateOptions,
} from "./di-context-base.js";

export class AsyncDIContext extends DIContextBase {
	private readonly moduleTreePromiseMap = new WeakMap<
		M,
		Promise<ModuleScopeTree>
	>();

	private constructor(options: DiContextOptions<any>) {
		super(options);
	}

	static async create<TModule extends M>(
		module: TModule | Promise<TModule>,
		options?: DiContextCreateOptions<TModule>,
	): Promise<ModuleScopeTree> {
		return new AsyncDIContext(options ?? {}).bootstrap(module);
	}

	private async bootstrap(module: M | Promise<M>): Promise<ModuleScopeTree> {
		this.rootModule = await module;
		await this.initializeGlobalModulesAsync();

		const moduleTree = await this.registerModuleWithScopeAsync(
			this.rootModule,
			this.createContainer(this.rootModule),
			[],
		);
		this.ensureAllModuleOverridesApplied();

		return moduleTree;
	}

	private async initializeGlobalModulesAsync(): Promise<void> {
		const globalModules = this.options.globalModules || [];

		const globalModuleImports = (
			await Promise.all(
				globalModules.map(async (module) =>
					(
						await this.resolveImportsAsync(module)
					).map((importedModule) => ({
						module,
						importedModule,
					})),
				),
			)
		).flat();

		this.ensureGlobalModulesDoNotImportGlobalModules(
			globalModules,
			globalModuleImports,
		);

		this.globalModulesWithScope = [];

		for (const module of globalModules) {
			const moduleTree = await this.registerModuleWithScopeAsync(
				module,
				this.createContainer(module),
				[],
			);
			this.globalModulesWithScope.push({
				...moduleTree,
				module: this.getEffectiveModule(module),
			});
		}
	}

	private async registerModuleWithScopeAsync(
		m: M,
		scope: Awilix.AwilixContainer,
		moduleChain: M[],
	): Promise<ModuleScopeTree> {
		const existingTree = this.moduleTreeMap.get(m);

		if (existingTree) {
			return existingTree;
		}

		const imports = await this.resolveImportsAsync(m);
		const moduleWithOverrides = this.applyModuleOverrides(m);
		this.ensureImportedModulesUniqueness(moduleWithOverrides, imports);
		this.ensureNoProviderNameConflicts(moduleWithOverrides, imports);
		this.markModuleIfImportsUseForwardRef(moduleWithOverrides);

		const isCircular = moduleChain.includes(m);

		if (isCircular) {
			this.ensureCircularDependencyHasForwardRef(m, moduleChain);

			return this.createModuleScopeTree(
				m.name,
				// biome-ignore lint/style/noNonNullAssertion: circular module was already registered
				this.moduleScopeMap.get(m)!,
				new Map(),
			);
		}

		const pendingTree = this.moduleTreePromiseMap.get(m);

		if (pendingTree) {
			return pendingTree;
		}

		const moduleTreePromise = this.registerNewModuleWithScopeAsync(
			// QUEST: why m and moduleWithOverrides at same time?
			m,
			moduleWithOverrides,
			scope,
			imports,
			moduleChain,
		);
		this.moduleTreePromiseMap.set(m, moduleTreePromise);

		return moduleTreePromise;
	}

	private async registerNewModuleWithScopeAsync(
		m: M,
		moduleWithOverrides: M,
		scope: Awilix.AwilixContainer,
		imports: M[],
		moduleChain: M[],
	): Promise<ModuleScopeTree> {
		this.moduleScopeMap.set(m, scope);

		const importedModulesWithScope = [
			...this.globalModulesWithScope,
			...(await Promise.all(
				imports.map(async (module) => {
					const moduleTree = await this.registerModuleWithScopeAsync(
						module,
						this.createContainer(module),
						[...moduleChain, m],
					);

					return {
						...moduleTree,
						module: this.getEffectiveModule(module),
					};
				}),
			)),
		];

		this.registerExportedProviders(scope, importedModulesWithScope);

		const moduleForSorting: M = {
			...moduleWithOverrides,
			imports: importedModulesWithScope.map((el) => el.module),
		};

		this.interceptorProcessor.processInterceptors(
			moduleWithOverrides,
			scope,
			importedModulesWithScope,
		);

		for (const [key, provider] of this.getProviderEntries(
			m,
			moduleForSorting,
		)) {
			scope.register({
				[key]: await this.providerResolver.resolveProviderAsync({
					key,
					provider,
					resolutionScope: scope,
					module: moduleWithOverrides,
				}),
			});
		}

		this.lifecycleProcessor.collectEagerProviders(moduleWithOverrides, scope);

		this.processModuleFeatures(
			moduleWithOverrides,
			scope,
			importedModulesWithScope,
		);

		const moduleTree = this.createModuleScopeTree(
			m.name,
			scope,
			this.buildImportedScopesMap(importedModulesWithScope),
		);
		this.moduleTreeMap.set(m, moduleTree);
		this.moduleTreePromiseMap.delete(m);

		return moduleTree;
	}

	private async resolveImportsAsync(m: M): Promise<M[]> {
		return Promise.all(
			(m.imports || []).map((importItem) =>
				GUARGS.isForwardRef(importItem) ? importItem.resolve() : importItem,
			),
		);
	}
}
