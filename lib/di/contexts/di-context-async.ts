import type * as Awilix from "awilix";
import type { InternalModuleLike as M } from "../modules/runtime-module.types.js";
import * as GUARGS from "../type-guards.js";
import type { ModuleScope } from "./container-context-base.js";
import type { DiContextOptions } from "./di-context-base.js";
import { DIContextBase } from "./di-context-base.js";

export class AsyncDIContext extends DIContextBase {
	private readonly moduleTreePromiseMap = new WeakMap<
		M,
		Promise<ModuleScope>
	>();

	private constructor(options: DiContextOptions) {
		super(options);
	}

	static async create(
		module: M | Promise<M>,
		options?: DiContextOptions,
	): Promise<ModuleScope> {
		return new AsyncDIContext(options ?? {}).bootstrap(module);
	}

	private async bootstrap(module: M | Promise<M>): Promise<ModuleScope> {
		const rootModule = await module;

		await this.initializeGlobalModulesAsync();

		const moduleTree = await this.registerModuleWithScopeAsync(
			rootModule,
			this.createContainer(rootModule),
			[],
		);
		this.overridesProcessor.ensureAllModuleOverridesApplied();

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

		this.moduleGraphEnsurer.ensureGlobalModulesDoNotImportGlobalModules({
			globalModules,
			globalModuleImports,
		});

		this.globalModulesWithScope = [];

		for (const module of globalModules) {
			const moduleTree = await this.registerModuleWithScopeAsync(
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

	private async registerModuleWithScopeAsync(
		m: M,
		scope: Awilix.AwilixContainer,
		moduleChain: M[],
	): Promise<ModuleScope> {
		const existingTree = this.moduleTreeMap.get(m);

		if (existingTree) {
			return existingTree;
		}

		const imports = await this.resolveImportsAsync(m);
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
	): Promise<ModuleScope> {
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
						module: this.overridesProcessor.getModuleWithOverrides(module),
						moduleScope: moduleTree,
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

		const providers = this.sorter.sortByDependencies(moduleForSorting);

		for (const [key, provider] of Object.entries(providers)) {
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
