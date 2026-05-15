import type * as Awilix from "awilix";
import type { InternalModuleLike as M } from "../modules/runtime-module.types.js";
import * as GUARGS from "../type-guards.js";
import type { DiContextOptions, ModuleScopeTree } from "./di-context-base.js";
import { DIContextBase } from "./di-context-base.js";

export class AsyncDIContext extends DIContextBase {
	private readonly moduleTreePromiseMap = new WeakMap<
		M,
		Promise<ModuleScopeTree>
	>();

	private constructor(options: DiContextOptions) {
		super(options);
	}

	static async create(
		module: M | Promise<M>,
		options?: DiContextOptions,
	): Promise<ModuleScopeTree> {
		return new AsyncDIContext(options ?? {}).bootstrap(module);
	}

	private async bootstrap(module: M | Promise<M>): Promise<ModuleScopeTree> {
		await this.initializeGlobalModulesAsync();

		return this.registerModuleWithScopeAsync(
			await module,
			this.createContainer(),
			[],
		);
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

		this.globalModulesWithScope = await Promise.all(
			globalModules.map(async (module) => ({
				...(await this.registerModuleWithScopeAsync(
					module,
					this.createContainer(),
					[],
					false,
				)),
				module,
			})),
		);
	}

	private async registerModuleWithScopeAsync(
		m: M,
		scope: Awilix.AwilixContainer,
		moduleChain: M[],
		includeGlobalModules = true,
	): Promise<ModuleScopeTree> {
		const existingTree = this.moduleTreeMap.get(m);

		if (existingTree) {
			return existingTree;
		}

		const imports = await this.resolveImportsAsync(m);
		this.ensureImportedModulesUniqueness(m, imports, includeGlobalModules);
		this.ensureNoProviderNameConflicts(m, imports, includeGlobalModules);
		this.markModuleIfImportsUseForwardRef(m);

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
			m,
			scope,
			imports,
			moduleChain,
			includeGlobalModules,
		);
		this.moduleTreePromiseMap.set(m, moduleTreePromise);

		return moduleTreePromise;
	}

	private async registerNewModuleWithScopeAsync(
		m: M,
		scope: Awilix.AwilixContainer,
		imports: M[],
		moduleChain: M[],
		includeGlobalModules: boolean,
	): Promise<ModuleScopeTree> {
		this.moduleScopeMap.set(m, scope);

		const importedModulesWithScope = [
			...(includeGlobalModules ? this.globalModulesWithScope : []),
			...(await Promise.all(
				imports.map(async (module) => ({
					...(await this.registerModuleWithScopeAsync(
						module,
						this.createContainer(),
						[...moduleChain, m],
						includeGlobalModules,
					)),
					module,
				})),
			)),
		];

		this.registerExportedProviders(scope, importedModulesWithScope);

		const moduleForSorting: M = {
			...m,
			imports: importedModulesWithScope.map((el) => el.module),
		};

		this.interceptorProcessor.processInterceptors(
			m,
			scope,
			importedModulesWithScope,
		);

		for (const [key, provider] of Object.entries(
			this.sorter.sortByDependencies(moduleForSorting),
		)) {
			scope.register({
				[key]: await this.providerResolver.resolveProviderAsync({
					key,
					provider,
					resolutionScope: scope,
					module: m,
				}),
			});
		}

		this.lifecycleProcessor.collectEagerProviders(m, scope);

		this.processModuleFeatures(m, scope, importedModulesWithScope);

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
