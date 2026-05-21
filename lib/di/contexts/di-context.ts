import type * as Awilix from "awilix";
import * as ERRORS from "../errors.js";
import type { InternalModuleLike as M } from "../modules/runtime-module.types.js";
import * as GUARGS from "../type-guards.js";
import type { DiContextOptions, ModuleScopeTree } from "./di-context-base.js";
import {
	DIContextBase,
	type DiContextCreateOptions,
} from "./di-context-base.js";

export class DIContext extends DIContextBase {
	private constructor(options: DiContextOptions<any>) {
		super(options);
	}

	static create<TModule extends M>(
		module: TModule,
		options?: DiContextCreateOptions<TModule>,
	): ModuleScopeTree {
		return new DIContext(options ?? {}).bootstrap(module);
	}

	private bootstrap(module: M): ModuleScopeTree {
		this.rootModule = module;
		this.initializeGlobalModules();

		const moduleTree = this.registerModuleWithScope(
			this.rootModule,
			this.createContainer(module),
			[],
		);
		this.ensureAllModuleOverridesApplied();

		return moduleTree;
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

		// Store the scope in the map before processing (for circular references)
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
					...moduleTree,
					module: this.getEffectiveModule(module),
				};
			}),
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

		this.getProviderEntries(m, moduleForSorting).forEach(([key, provider]) => {
			scope.register({
				[key]: this.providerResolver.resolveProvider({
					key,
					provider,
					resolutionScope: scope,
					module: moduleWithOverrides,
				}),
			});
		});

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
			const moduleTree = this.registerModuleWithScope(
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
