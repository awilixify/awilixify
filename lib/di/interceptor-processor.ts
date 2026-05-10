import * as Awilix from "awilix";
import { getClassInterceptorState } from "../decorators/interceptor-state.js";
import type { DiContextOptions } from "./di-context.js";
import * as ERRORS from "./errors.js";
import type { Interceptor } from "./interceptor.types.js";
import type { AnyInterceptor } from "./provider.types.js";
import { getOrCreateRequestScope } from "./request-scope-context.js";
import type { InternalModuleLike as M } from "./runtime-module.types.js";
import { isClassInterceptor } from "./type-guards.js";

type ModuleWithScope = {
	module: M;
	scope: Awilix.AwilixContainer;
};

export class InterceptorProcessor {
	private readonly resolversByModule = new WeakMap<
		M,
		Array<() => Interceptor>
	>();

	constructor(
		private readonly providerOptions: DiContextOptions["providerOptions"],
	) {}

	public processInterceptors(
		m: M,
		scope: Awilix.AwilixContainer,
		importedModulesWithScope: ModuleWithScope[],
	): void {
		const resolvers: Array<() => Interceptor> = [];
		const ownerByKey = new Map<string, string>();

		for (const {
			module: importedModule,
			scope: importedScope,
		} of importedModulesWithScope) {
			for (const key of importedModule.interceptorExports || []) {
				const interceptor = importedModule.interceptors?.[key];
				if (!interceptor) {
					throw new ERRORS.InvalidProviderDefinitionError(
						importedModule.name,
						key,
					);
				}

				if (ownerByKey.has(key)) {
					throw new ERRORS.InterceptorNameConflictError(
						m.name,
						key,
						ownerByKey.get(key) || importedModule.name,
					);
				}

				const symbol = Symbol(
					`interceptor_export_${importedModule.name}_${key}`,
				);
				scope.register({
					[symbol]: this.resolveInterceptedProvider({
						interceptor,
						resolutionScope: importedScope,
						module: importedModule,
						wrapForExport: true,
					}),
				});

				resolvers.push(() => scope.resolve(symbol));
				ownerByKey.set(key, importedModule.name);
			}
		}

		for (const [key, interceptor] of Object.entries(m.interceptors || {})) {
			if (ownerByKey.has(key)) {
				throw new ERRORS.InterceptorNameConflictError(
					m.name,
					key,
					ownerByKey.get(key) || m.name,
				);
			}

			const symbol = Symbol(`interceptor_${m.name}_${key}`);
			scope.register({
				[symbol]: this.resolveInterceptedProvider({
					interceptor,
					resolutionScope: scope,
					module: m,
				}),
			});

			resolvers.push(() => scope.resolve(symbol));
			ownerByKey.set(key, m.name);
		}

		this.resolversByModule.set(m, resolvers);
	}

	public createInterceptedProviderResolver({
		module,
		useClass,
		options,
		resolver,
	}: {
		module: M;
		useClass: new (...args: any[]) => object;
		options: Awilix.BuildResolverOptions<any>;
		resolver?: Awilix.Resolver<any>;
	}): Awilix.Resolver<any> {
		const baseResolver = resolver || Awilix.asClass(useClass, options);
		const interceptors = this.resolversByModule.get(module) ?? [];

		if (
			interceptors.length === 0 ||
			!this.hasMethodInterceptorMetadata(useClass)
		) {
			return baseResolver;
		}

		return Awilix.createBuildResolver({
			...options,
			resolve: (container) =>
				this.createInterceptedProviderInstance(
					baseResolver.resolve(container),
					useClass,
					interceptors,
				),
		});
	}

	private createInterceptedProviderInstance<T extends object>(
		instance: T,
		metadataTarget: object,
		resolveInterceptors: Array<() => Interceptor>,
	): T {
		const wrappers = new Map<PropertyKey, (...args: unknown[]) => unknown>();
		const self = this;

		return new Proxy(instance, {
			get(target, propertyKey, proxyReceiver) {
				const value = Reflect.get(target, propertyKey, proxyReceiver);

				if (typeof value !== "function") return value;

				const existing = wrappers.get(propertyKey);

				if (existing) return existing;

				const interceptorState = self.resolveMethodInterceptorsState(
					metadataTarget,
					propertyKey,
				);

				if (!interceptorState) {
					const fallback = (...args: unknown[]) => value.apply(target, args);
					wrappers.set(propertyKey, fallback);

					return fallback;
				}

				const wrapped = (...args: unknown[]) => {
					const interceptors = resolveInterceptors.map((resolve) => resolve());

					return self.callWithInterceptorChain({
						target,
						methodName: propertyKey,
						args,
						metadataByToken: interceptorState,
						interceptors,
						proceed: () => value.apply(target, args),
					});
				};

				wrappers.set(propertyKey, wrapped);

				return wrapped;
			},
		});
	}

	private callWithInterceptorChain({
		target,
		methodName,
		args,
		metadataByToken,
		interceptors,
		proceed,
	}: {
		target: object;
		methodName: string | symbol;
		args: unknown[];
		metadataByToken: Map<symbol, unknown>;
		interceptors: Interceptor[];
		proceed: () => unknown | Promise<unknown>;
	}): unknown | Promise<unknown> {
		const invoke = (
			index: number,
			next: () => unknown | Promise<unknown>,
		): unknown | Promise<unknown> => {
			if (index >= interceptors.length) return next();

			const current = interceptors[index];

			if (!current) return next();
			const metadata = metadataByToken.get(current.token.key);

			if (metadata === undefined) {
				return invoke(index + 1, next);
			}

			return current.intercept({
				target,
				methodName,
				args,
				metadata,
				proceed: () => invoke(index + 1, next),
			});
		};

		return invoke(0, proceed);
	}

	private resolveInterceptedProvider({
		interceptor,
		resolutionScope,
		module,
		wrapForExport,
	}: {
		interceptor: AnyInterceptor;
		resolutionScope: Awilix.AwilixContainer;
		module: M;
		wrapForExport?: boolean;
	}): Awilix.Resolver<Interceptor> {
		const { useClass: InterceptorClass, ...interceptorOptions } =
			isClassInterceptor(interceptor) ? interceptor : { useClass: interceptor };

		const resolverOptions: Awilix.BuildResolverOptions<any> = {
			...this.providerOptions,
			...module.providerOptions,
			...interceptorOptions,
		};

		const resolver = Awilix.asClass(InterceptorClass, resolverOptions);

		if (!wrapForExport) return resolver;

		return Awilix.asFunction(
			() =>
				resolver.resolve(
					resolverOptions.lifetime === Awilix.Lifetime.SINGLETON
						? resolutionScope
						: getOrCreateRequestScope(resolutionScope),
				),
			resolverOptions,
		);
	}

	private resolveMethodInterceptorsState(
		target: any,
		methodName: string | symbol,
	) {
		const state = getClassInterceptorState(target);

		if (!state) return null;

		return state.methods.get(methodName) || null;
	}

	private hasMethodInterceptorMetadata(target: any) {
		const state = getClassInterceptorState(target);

		return state && state.methods.size > 0;
	}
}
