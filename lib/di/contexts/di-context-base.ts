import * as Awilix from "awilix";
import * as ERRORS from "../errors.js";
import type { InternalModuleLike as M } from "../modules/runtime-module.types.js";
import { ControllerProcessor } from "../processors/controller-processor.js";
import {
	HandlerProcessor,
	HandlerType,
} from "../processors/handler-processor.js";
import { InitializerProcessor } from "../processors/initializer-processor.js";
import { InterceptorProcessor } from "../processors/interceptor-processor.js";
import { LifecycleProcessor } from "../processors/lifecycle-processor.js";
import type { AnyProvider } from "../providers/provider.types.js";
import { ProviderDependencySorter } from "../providers/provider-dependency-sorter.js";
import { ProviderResolver } from "../providers/provider-resolver.js";
import {
	hasRequestScopeContext,
	resolveFromRequestScope,
} from "../request-scope-context.js";
import * as GUARGS from "../type-guards.js";
import type { AnyModuleOverride } from "./module-overrides.js";
import type {
	AnyProviderOverrides,
	ProviderOverridesFor,
} from "./provider-overrides.types.js";

export type DiContextCreateOptions<TModule extends M> = DiContextOptions<
	ProviderOverridesFor<TModule>
>;

export interface DiContextOptions<TProviderOverrides = AnyProviderOverrides> {
	containerOptions?: Awilix.ContainerOptions;
	providerOptions?: Partial<Awilix.BuildResolverOptions<any>>;
	globalModules?: readonly M[];
	skipRegisterRoutes?: boolean;
	providerOverrides?: TProviderOverrides;
	moduleOverrides?: readonly AnyModuleOverride[];
}

export interface ModuleInitOptions {
	excludeInitializers?: true | readonly string[];
	excludePostInit?: true | readonly string[];
}

export interface ModuleScopeTree<
	S extends Awilix.AwilixContainer = Awilix.AwilixContainer,
> {
	name: string;
	scope: S;
	importedScopes: Map<string, ModuleScopeTree>;
	init(options?: ModuleInitOptions): Promise<void>;
	dispose(): Promise<void>;
}

export class DIContextBase {
	protected readonly forwardRefModules = new WeakSet<M>();
	protected readonly moduleScopeMap = new WeakMap<M, Awilix.AwilixContainer>();
	protected readonly moduleTreeMap = new WeakMap<M, ModuleScopeTree>();
	protected readonly sorter = new ProviderDependencySorter();
	protected readonly controllerProcessor: ControllerProcessor;
	protected readonly handlerProcessor: HandlerProcessor;
	protected readonly interceptorProcessor: InterceptorProcessor;
	protected readonly initializerProcessor = new InitializerProcessor();
	protected readonly lifecycleProcessor: LifecycleProcessor;
	protected readonly providerResolver: ProviderResolver;
	protected readonly options: DiContextOptions<any>;
	protected globalModulesWithScope: (ModuleScopeTree & { module: M })[] = [];
	protected rootModule?: M;
	private readonly effectiveModuleMap = new WeakMap<M, M>();
	private readonly appliedModuleOverrides = new WeakSet<M>();
	private readonly createdScopes: Awilix.AwilixContainer[] = [];
	private disposePromise?: Promise<void>;

	protected constructor(options: DiContextOptions<any>) {
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

		this.handlerProcessor = new HandlerProcessor(
			this.options.providerOptions || {},
		);
		this.interceptorProcessor = new InterceptorProcessor(
			this.options.providerOptions || {},
		);
		this.controllerProcessor = new ControllerProcessor(
			this.interceptorProcessor,
			this.options.providerOptions || {},
			this.options.skipRegisterRoutes === true,
		);
		this.providerResolver = new ProviderResolver(
			this.interceptorProcessor,
			this.options.providerOptions || {},
		);
		this.lifecycleProcessor = new LifecycleProcessor(
			this.options.providerOptions || {},
		);
	}

	protected createContainer(module?: M): Awilix.AwilixContainer {
		const scope = Awilix.createContainer({
			...this.options.containerOptions,
			...module?.containerOptions,
		});
		this.createdScopes.push(scope);

		return scope;
	}

	protected registerExportedProviders(
		scope: Awilix.AwilixContainer,
		importedModulesWithScope: (ModuleScopeTree & { module: M })[],
	): void {
		importedModulesWithScope.forEach(
			({ module: importedModule, scope: importedScope }) => {
				this.getExportedProviderKeys(importedModule).forEach((key) => {
					if (!importedModule.providers?.[key]) {
						throw new ERRORS.InvalidProviderDefinitionError(
							importedModule.name,
							key,
						);
					}

					scope.register({
						[key]: Awilix.asFunction(
							() => {
								// biome-ignore lint/style/noNonNullAssertion: provider must be registered
								const registration = importedScope.registrations[key]!;

								return registration.lifetime === Awilix.Lifetime.SINGLETON
									? importedScope.resolve(key)
									: hasRequestScopeContext()
										? resolveFromRequestScope(importedScope, key)
										: importedScope.resolve(key);
							},
							{
								lifetime: Awilix.Lifetime.TRANSIENT,
								isLeakSafe: true,
							},
						),
					});
				});
			},
		);
	}

	protected ensureImportedModulesUniqueness(m: M, resolvedImports: M[]) {
		const importedNames = new Set<string>();

		const imports = [
			...this.globalModulesWithScope.map((el) => el.module),
			...resolvedImports,
		];

		for (const imported of imports) {
			if (importedNames.has(imported.name)) {
				throw new ERRORS.DuplicateModuleImportError(m.name, imported.name);
			}

			importedNames.add(imported.name);
		}
	}

	protected ensureGlobalModulesDoNotImportGlobalModules(
		globalModules: readonly M[],
		globalModuleImports: readonly {
			module: M;
			importedModule: M;
		}[],
	): void {
		const globalModuleNames = new Set<string>();

		for (const globalModule of globalModules) {
			if (globalModuleNames.has(globalModule.name)) {
				throw new ERRORS.DuplicateModuleImportError(
					"globalModules",
					globalModule.name,
				);
			}
			globalModuleNames.add(globalModule.name);
		}

		for (const { module, importedModule } of globalModuleImports) {
			if (globalModuleNames.has(importedModule.name)) {
				throw new ERRORS.GlobalModuleImportsGlobalModuleError(
					module.name,
					importedModule.name,
				);
			}
		}
	}

	protected ensureNoProviderNameConflicts(m: M, resolvedImports: M[]) {
		const moduleProviderKeys = Object.keys(m.providers || {});

		const importConflicts = [
			...this.globalModulesWithScope.flatMap(({ module: globalModule }) =>
				this.getExportedProviderKeys(globalModule),
			),
			...resolvedImports.flatMap((importItem) =>
				this.getExportedProviderKeys(importItem),
			),
		].filter((key) => moduleProviderKeys.includes(key));

		if (importConflicts.length > 0) {
			throw new ERRORS.ProviderNameConflictError(m.name, importConflicts);
		}
	}

	protected getExportedProviderKeys(module: M): string[] {
		return module.exports ? [...module.exports] : [];
	}

	protected markModuleIfImportsUseForwardRef(m: M): void {
		if ((m.imports || []).some(GUARGS.isForwardRef))
			this.forwardRefModules.add(m);
	}

	protected ensureCircularDependencyHasForwardRef(
		m: M,
		moduleChain: M[],
	): void {
		const hasForwardRefInCycle =
			this.forwardRefModules.has(m) ||
			moduleChain.some((module) => this.forwardRefModules.has(module));

		if (hasForwardRefInCycle) return;

		const chainNames = moduleChain.map((module) => module.name);
		throw new ERRORS.CircularModuleDependencyError(m.name, chainNames);
	}

	protected processModuleFeatures(
		m: M,
		scope: Awilix.AwilixContainer,
		importedModulesWithScope: (ModuleScopeTree & { module: M })[],
	): void {
		this.handlerProcessor.processHandlers(
			m,
			scope,
			importedModulesWithScope,
			HandlerType.Query,
		);
		this.handlerProcessor.processHandlers(
			m,
			scope,
			importedModulesWithScope,
			HandlerType.Command,
		);
		const controllers = this.controllerProcessor.processControllers(m, scope);
		this.lifecycleProcessor.addInitializerTask(
			this.initializerProcessor.collectInitializers(
				m,
				scope,
				importedModulesWithScope,
				controllers,
			),
		);
	}

	protected applyModuleOverrides(m: M): M {
		const moduleOverride = this.options.moduleOverrides?.find(
			(override) => override.module === m,
		);

		if (!moduleOverride) {
			this.effectiveModuleMap.set(m, m);
			return m;
		}

		this.ensureModuleOverrideKeysExist(m, moduleOverride);
		this.appliedModuleOverrides.add(m);

		const effectiveModule = {
			...m,
			providers: {
				...m.providers,
				...moduleOverride.overrides.providers,
			} as M["providers"],
			queryPreHandlers: {
				...m.queryPreHandlers,
				...moduleOverride.overrides.queryPreHandlers,
			} as M["queryPreHandlers"],
			commandPreHandlers: {
				...m.commandPreHandlers,
				...moduleOverride.overrides.commandPreHandlers,
			} as M["commandPreHandlers"],
			interceptors: {
				...m.interceptors,
				...moduleOverride.overrides.interceptors,
			} as M["interceptors"],
			initializers: {
				...m.initializers,
				...moduleOverride.overrides.initializers,
			} as M["initializers"],
		};
		this.effectiveModuleMap.set(m, effectiveModule);

		return effectiveModule;
	}

	protected getEffectiveModule(m: M): M {
		return this.effectiveModuleMap.get(m) ?? m;
	}

	protected ensureAllModuleOverridesApplied(): void {
		for (const override of this.options.moduleOverrides ?? []) {
			if (!this.appliedModuleOverrides.has(override.module)) {
				throw new ERRORS.ModuleOverrideTargetNotFoundError(
					override.module.name,
				);
			}
		}
	}

	protected getProviderEntries(
		m: M,
		moduleForSorting: M,
	): [string, AnyProvider][] {
		const providers = this.sorter.sortByDependencies(
			this.applyRootProviderOverrides(m, moduleForSorting),
		);

		return Object.entries(providers);
	}

	private applyRootProviderOverrides(m: M, moduleForSorting: M): M {
		const overrides = this.options.providerOverrides;

		if (m !== this.rootModule || !overrides) {
			return moduleForSorting;
		}

		const providerKeys = new Set(Object.keys(m.providers || {}));

		for (const key of Object.keys(overrides)) {
			if (!providerKeys.has(key)) {
				throw new ERRORS.ProviderOverrideNotFoundError(m.name, key);
			}
		}

		return {
			...moduleForSorting,
			providers: {
				...moduleForSorting.providers,
				...overrides,
			} as NonNullable<M["providers"]>,
		};
	}

	private ensureModuleOverrideKeysExist(
		m: M,
		moduleOverride: AnyModuleOverride,
	): void {
		this.ensureFeatureOverrideKeysExist(
			m,
			"providers",
			moduleOverride.overrides.providers,
		);
		this.ensureFeatureOverrideKeysExist(
			m,
			"queryPreHandlers",
			moduleOverride.overrides.queryPreHandlers,
		);
		this.ensureFeatureOverrideKeysExist(
			m,
			"commandPreHandlers",
			moduleOverride.overrides.commandPreHandlers,
		);
		this.ensureFeatureOverrideKeysExist(
			m,
			"interceptors",
			moduleOverride.overrides.interceptors,
		);
		this.ensureFeatureOverrideKeysExist(
			m,
			"initializers",
			moduleOverride.overrides.initializers,
		);
	}

	private ensureFeatureOverrideKeysExist(
		m: M,
		featureKind:
			| "providers"
			| "queryPreHandlers"
			| "commandPreHandlers"
			| "interceptors"
			| "initializers",
		overrides: Record<string, unknown> | undefined,
	): void {
		if (!overrides) return;

		const featureKeys = new Set(Object.keys(m[featureKind] || {}));

		for (const key of Object.keys(overrides)) {
			if (!featureKeys.has(key)) {
				throw new ERRORS.ModuleFeatureOverrideNotFoundError(
					m.name,
					featureKind,
					key,
				);
			}
		}
	}

	protected createModuleScopeTree(
		name: string,
		scope: Awilix.AwilixContainer,
		importedScopes: ModuleScopeTree["importedScopes"],
	): ModuleScopeTree {
		return {
			name,
			scope,
			importedScopes,
			init: (options) => this.lifecycleProcessor.init(options),
			dispose: () => this.dispose(),
		};
	}

	private dispose(): Promise<void> {
		this.disposePromise ??= this.executeDispose();

		return this.disposePromise;
	}

	private async executeDispose(): Promise<void> {
		const uniqueScopes = Array.from(new Set(this.createdScopes)).reverse();

		for (const scope of uniqueScopes) {
			await scope.dispose();
		}
	}

	protected buildImportedScopesMap(
		importedModulesWithScope: (ModuleScopeTree & { module: M })[],
	): ModuleScopeTree["importedScopes"] {
		return importedModulesWithScope.reduce((acc, { module, ...rest }) => {
			acc.set(rest.name, rest);

			return acc;
		}, new Map());
	}
}
