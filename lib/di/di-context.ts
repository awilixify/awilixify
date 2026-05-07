import * as Awilix from "awilix";
import type { RouteRegistration } from "../http/openapi-builder.js";
import { ControllerInitializerProcessor } from "./controller-initializer-processor.js";
import { ControllerProcessor } from "./controller-processor.js";
import * as ERRORS from "./errors.js";
import { HandlerProcessor, HandlerType } from "./handler-processor.js";
import { InterceptorProcessor } from "./interceptor-processor.js";
import type { AnyProvider } from "./provider.types.js";
import { ProviderDependencySorter } from "./provider-dependency-sorter.js";
import {
	hasRequestScopeContext,
	resolveFromRequestScope,
} from "./request-scope-context.js";
import type { InternalModuleLike as M } from "./runtime-module.types.js";
import * as GUARGS from "./type-guards.js";

export interface DiContextOptions {
	framework: unknown;
	beforeRouteRegistered?: (params: RouteRegistration) => any[];
	containerOptions?: Awilix.ContainerOptions;
	providerOptions?: Partial<Awilix.BuildResolverOptions<any>>;
	globalModules?: readonly M[];
}

export interface ModuleScopeTree<
	S extends Awilix.AwilixContainer = Awilix.AwilixContainer,
> {
	name: string;
	scope: S;
	importedScopes: Map<string, ModuleScopeTree>;
}

export class DIContext {
	private readonly forwardRefModules = new WeakSet<M>();
	private readonly moduleScopeMap = new WeakMap<M, Awilix.AwilixContainer>();
	private readonly moduleTreeMap = new WeakMap<M, ModuleScopeTree>();
	private readonly sorter = new ProviderDependencySorter();
	private readonly controllerProcessor: ControllerProcessor;
	private readonly handlerProcessor: HandlerProcessor;
	private readonly interceptorProcessor: InterceptorProcessor;
	private readonly controllerInitializerProcessor: ControllerInitializerProcessor;
	private readonly options: DiContextOptions;
	private globalModulesWithScope: (ModuleScopeTree & { module: M })[] = [];

	private constructor(options: DiContextOptions) {
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

		this.controllerProcessor = new ControllerProcessor(
			this.options.framework,
			this.options.providerOptions || {},
			this.options.beforeRouteRegistered,
		);
		this.handlerProcessor = new HandlerProcessor(
			this.options.providerOptions || {},
		);
		this.interceptorProcessor = new InterceptorProcessor(
			this.options.providerOptions || {},
		);
		this.controllerInitializerProcessor = new ControllerInitializerProcessor();
	}

	static create(module: M, options: DiContextOptions): ModuleScopeTree {
		const context = new DIContext(options);
		context.initializeGlobalModules();

		return context.registerModuleWithScope(
			module,
			context.createContainer(),
			[],
		);
	}

	private createContainer(): Awilix.AwilixContainer {
		return Awilix.createContainer(this.options.containerOptions);
	}

	private registerModuleWithScope(
		m: M,
		scope: Awilix.AwilixContainer,
		moduleChain: M[],
		includeGlobalModules = true,
	): ModuleScopeTree {
		const existingTree = this.moduleTreeMap.get(m);

		if (existingTree) {
			return existingTree;
		}

		this.ensureImportedModulesUniqueness(m, includeGlobalModules);
		this.ensureNoProviderNameConflicts(m, includeGlobalModules);
		this.markModuleIfImportsUseForwardRef(m);

		const isCircular = moduleChain.includes(m);

		if (isCircular) {
			this.ensureCircularDependencyHasForwardRef(m, moduleChain);

			return {
				name: m.name,
				// biome-ignore lint/style/noNonNullAssertion: circular module was already registered
				scope: this.moduleScopeMap.get(m)!,
				importedScopes: new Map(),
			};
		}

		// Store the scope in the map before processing (for circular references)
		this.moduleScopeMap.set(m, scope);

		const importedModulesWithScope = [
			...(includeGlobalModules ? this.globalModulesWithScope : []),
			...this.resolveImports(m).map((module) => ({
				...this.registerModuleWithScope(
					module,
					this.createContainer(),
					[...moduleChain, m],
					includeGlobalModules,
				),
				module,
			})),
		];

		importedModulesWithScope.forEach(
			({ module: importedModule, scope: importedScope }) => {
				Object.keys(importedModule.exports || {}).forEach((key) => {
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
									: // Use request scope only when one is active; otherwise
										// fallback to owner scope to avoid creating synthetic
										// request scopes on every non-request resolve.
										hasRequestScopeContext()
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
					[key]: this.resolveProvider({
						provider,
						resolutionScope: scope,
						module: m,
					}),
				});
			},
		);

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
		this.controllerInitializerProcessor.processControllerInitializers(
			m,
			scope,
			importedModulesWithScope,
			controllers,
		);

		const moduleTree = {
			scope,
			importedScopes: this.buildImportedScopesMap(importedModulesWithScope),
			name: m.name,
		};
		this.moduleTreeMap.set(m, moduleTree);

		return moduleTree;
	}

	private initializeGlobalModules(): void {
		const globalModules = this.options.globalModules || [];
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

		for (const globalModule of globalModules) {
			for (const importedModule of this.resolveImports(globalModule)) {
				if (globalModuleNames.has(importedModule.name)) {
					throw new ERRORS.GlobalModuleImportsGlobalModuleError(
						globalModule.name,
						importedModule.name,
					);
				}
			}
		}

		this.globalModulesWithScope = globalModules.map((module) => ({
			...this.registerModuleWithScope(
				module,
				this.createContainer(),
				[],
				false,
			),
			module,
		}));
	}

	private resolveProvider({
		provider,
		resolutionScope,
		module,
	}: {
		provider: AnyProvider;
		resolutionScope: Awilix.AwilixContainer;
		module: M;
	}): Awilix.Resolver<any> {
		if (GUARGS.isPrimitive(provider)) {
			return Awilix.asValue(provider);
		}

		if (
			GUARGS.isPlainFunction(provider) &&
			!GUARGS.isCostructorProvider(provider)
		) {
			return Awilix.asValue(provider);
		}

		// Handle plain objects as values (not class instances or providers)
		if (
			typeof provider === "object" &&
			!GUARGS.isCostructorProvider(provider) &&
			!GUARGS.isFactoryProvider(provider) &&
			!GUARGS.isClassProvider(provider)
		) {
			return Awilix.asValue(provider);
		}

		const resolverOptions = this.extractResolverOptions(module, provider);

		if (GUARGS.isCostructorProvider(provider)) {
			return this.interceptorProcessor.createInterceptedProviderResolver({
				module,
				useClass: provider,
				options: resolverOptions,
			});
		}

		if (GUARGS.isFactoryProvider(provider)) {
			const factoryDeps = (provider.inject || []).map((k) =>
				// biome-ignore lint/style/noNonNullAssertion: dependencies are validated by ProviderDependencySorter
				resolutionScope.registrations[k]!.resolve(resolutionScope),
			);

			return Awilix.asFunction(
				() => provider.useFactory(...factoryDeps),
				resolverOptions,
			);
		}

		const baseResolver = Awilix.asClass(provider.useClass, resolverOptions);
		const classResolver = provider.allowCircular
			? this.createProxyResolver(baseResolver, resolverOptions)
			: baseResolver;

		return this.interceptorProcessor.createInterceptedProviderResolver({
			module,
			useClass: provider.useClass,
			options: resolverOptions,
			resolver: classResolver,
		});
	}

	private extractResolverOptions(
		module: M,
		provider: AnyProvider,
	): Awilix.BuildResolverOptions<any> {
		const baseOptions = {
			...this.options.providerOptions,
			...module.providerOptions,
		};

		if (GUARGS.isClassProvider(provider)) {
			const { useClass, allowCircular, ...providerOptions } = provider;

			return {
				...baseOptions,
				...providerOptions,
			};
		}

		if (GUARGS.isFactoryProvider(provider)) {
			const { useClass, ...providerOptions } = GUARGS.isClassProvider(
				provider.provide,
			)
				? provider.provide
				: {};

			return {
				...baseOptions,
				...providerOptions,
			};
		}

		return baseOptions;
	}

	// https://github.com/jeffijoe/awilix/pull/133#issuecomment-492989852
	private createProxyResolver(
		resolver: Awilix.Resolver<any>,
		options: Awilix.BuildResolverOptions<any>,
	) {
		return Awilix.createBuildResolver({
			...options,
			resolve(container) {
				let resolved: any = null;

				return new Proxy(
					{},
					{
						get(_, name) {
							if (!resolved) {
								resolved = resolver.resolve(container);
							}

							return resolved[name];
						},
					},
				);
			},
		});
	}

	private markModuleIfImportsUseForwardRef(m: M): void {
		if ((m.imports || []).some(GUARGS.isForwardRef))
			this.forwardRefModules.add(m);
	}

	private ensureCircularDependencyHasForwardRef(m: M, moduleChain: M[]): void {
		const hasForwardRefInCycle =
			this.forwardRefModules.has(m) ||
			moduleChain.some((module) => this.forwardRefModules.has(module));

		if (hasForwardRefInCycle) return;

		const chainNames = moduleChain.map((module) => module.name);
		throw new ERRORS.CircularModuleDependencyError(m.name, chainNames);
	}

	private ensureImportedModulesUniqueness(m: M, includeGlobalModules = false) {
		const importedNames = new Set<string>();

		const imports = [
			...(includeGlobalModules
				? this.globalModulesWithScope.map((el) => el.module)
				: []),
			...this.resolveImports(m),
		];

		for (const imported of imports) {
			if (importedNames.has(imported.name)) {
				throw new ERRORS.DuplicateModuleImportError(m.name, imported.name);
			}

			importedNames.add(imported.name);
		}
	}

	private ensureNoProviderNameConflicts(m: M, includeGlobalModules = false) {
		const moduleProviderKeys = Object.keys(m.providers || {});

		const importConflicts = [
			...(includeGlobalModules
				? this.globalModulesWithScope.flatMap(({ module: globalModule }) =>
						Object.keys(globalModule.exports || {}),
					)
				: []),
			...this.resolveImports(m).flatMap((importItem) =>
				Object.keys(importItem.exports || {}),
			),
		].filter((key) => moduleProviderKeys.includes(key));

		if (importConflicts.length > 0) {
			throw new ERRORS.ProviderNameConflictError(m.name, importConflicts);
		}
	}

	private resolveImports(m: M): M[] {
		return (m.imports || []).map((importItem) =>
			GUARGS.isForwardRef(importItem) ? importItem.resolve() : importItem,
		);
	}

	private buildImportedScopesMap(
		importedModulesWithScope: (ModuleScopeTree & { module: M })[],
	): ModuleScopeTree["importedScopes"] {
		return importedModulesWithScope.reduce((acc, { module, ...rest }) => {
			acc.set(rest.name, rest);

			return acc;
		}, new Map());
	}
}
