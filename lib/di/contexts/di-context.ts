import type * as Awilix from "awilix";
import * as ERRORS from "../errors.js";
import type { InternalModuleLike as M } from "../modules/runtime-module.types.js";
import * as GUARGS from "../type-guards.js";
import type { DiContextOptions, ModuleScopeTree } from "./di-context-base.js";
import { DIContextBase } from "./di-context-base.js";

export type { DiContextOptions, ModuleScopeTree } from "./di-context-base.js";

export class DIContext extends DIContextBase {
	private constructor(options: DiContextOptions) {
		super(options);
	}

	static create(module: M, options?: DiContextOptions): ModuleScopeTree {
		return new DIContext(options ?? {}).bootstrap(module);
	}

	private bootstrap(module: M): ModuleScopeTree {
		this.initializeGlobalModules();

		return this.registerModuleWithScope(module, this.createContainer(module), []);
	}

	private registerModuleWithScope(
		m: M,
		scope: Awilix.AwilixContainer,
		moduleChain: M[],
	): ModuleScopeTree {
		const existingTree = this.moduleTreeMap.get(m);

		if (existingTree) {
			return existingTree;
		}

		const imports = this.resolveImports(m);
		this.ensureImportedModulesUniqueness(m, imports);
		this.ensureNoProviderNameConflicts(m, imports);
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

		// Store the scope in the map before processing (for circular references)
		this.moduleScopeMap.set(m, scope);

			const importedModulesWithScope = [
				...this.globalModulesWithScope,
				...imports.map((module) => ({
					...this.registerModuleWithScope(
						module,
						this.createContainer(module),
						[...moduleChain, m],
					),
					module,
				})),
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

		Object.entries(this.sorter.sortByDependencies(moduleForSorting)).forEach(
			([key, provider]) => {
				scope.register({
					[key]: this.providerResolver.resolveProvider({
						key,
						provider,
						resolutionScope: scope,
						module: m,
					}),
				});
			},
		);

		this.lifecycleProcessor.collectEagerProviders(m, scope);

		this.processModuleFeatures(m, scope, importedModulesWithScope);

		const moduleTree = this.createModuleScopeTree(
			m.name,
			scope,
			this.buildImportedScopesMap(importedModulesWithScope),
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
		this.ensureGlobalModulesDoNotImportGlobalModules(
			globalModules,
			globalModuleImports,
		);

		this.globalModulesWithScope = [];

			for (const module of globalModules) {
				this.globalModulesWithScope.push({
					...this.registerModuleWithScope(
						module,
						this.createContainer(module),
						[],
					),
					module,
				});
			}
	}

	private resolveImports(m: M): M[] {
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
}
