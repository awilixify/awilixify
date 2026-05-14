import * as Awilix from "awilix";
import { resolveDecoratorState } from "../../decorators/decorator-state.js";
import type { DecoratorState } from "../../decorators/decorator-state.types.js";
import type { DiContextOptions } from "../contexts/di-context-base.js";
import type { InternalModuleLike as M } from "../modules/runtime-module.types.js";
import type { Interceptor } from "../providers/provider.types.js";
import { KeyedFeatureRegistrar } from "./keyed-feature-registrar.js";

type ModuleWithScope = {
	module: M;
	scope: Awilix.AwilixContainer;
};

type InterceptorMetadata = {
	state: DecoratorState<any, any>;
	method: unknown;
};

export class InterceptorProcessor {
	private readonly keyedFeatureRegistrar: KeyedFeatureRegistrar;

	private readonly resolversByModule = new WeakMap<
		M,
		Map<string, () => Interceptor>
	>();

	constructor(providerOptions: DiContextOptions["providerOptions"]) {
		this.keyedFeatureRegistrar = new KeyedFeatureRegistrar(
			providerOptions ?? {},
		);
	}

	public processInterceptors(
		m: M,
		scope: Awilix.AwilixContainer,
		importedModulesWithScope: ModuleWithScope[],
	): void {
		const resolverMap = this.keyedFeatureRegistrar.register<Interceptor>({
			featureKind: "interceptors",
			module: m,
			scope,
			importedModulesWithScope,
		});

		this.resolversByModule.set(m, resolverMap);
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
		const interceptors = [
			...(this.resolversByModule.get(module)?.values() ?? []),
		];

		if (interceptors.length === 0) {
			return baseResolver;
		}

		return Awilix.createBuildResolver({
			...options,
			resolve: (container) =>
				this.createInterceptedProviderInstance(
					baseResolver.resolve(container),
					useClass,
					interceptors,
					module.name,
				),
		});
	}

	private createInterceptedProviderInstance<T extends object>(
		instance: T,
		metadataTarget: object,
		resolveInterceptors: Array<() => Interceptor>,
		moduleName: string,
	): T {
		const wrappers = new Map<PropertyKey, (...args: unknown[]) => unknown>();
		const self = this;

		return new Proxy(instance, {
			get(target, propertyKey, proxyReceiver) {
				const value = Reflect.get(target, propertyKey, proxyReceiver);

				if (typeof value !== "function") return value;

				const existing = wrappers.get(propertyKey);

				if (existing) return existing;

				const wrapped = (...args: unknown[]) => {
					const interceptors = resolveInterceptors.map((resolve) => resolve());
					const metadataByToken = new Map<symbol, InterceptorMetadata>();
					for (const interceptor of interceptors) {
						const state = resolveDecoratorState(
							metadataTarget,
							interceptor.token,
						);

						if (state === null) continue;

						const method = state.methods.get(propertyKey);

						if (method !== undefined) {
							metadataByToken.set(interceptor.token.stateSymbol, {
								state,
								method,
							});
						}
					}

					if (metadataByToken.size === 0) return value.apply(target, args);

					return self.callWithInterceptorChain({
						target,
						methodName: propertyKey,
						moduleName,
						args,
						metadataByToken,
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
		moduleName,
		args,
		metadataByToken,
		interceptors,
		proceed,
	}: {
		target: object;
		methodName: string | symbol;
		moduleName: string;
		args: unknown[];
		metadataByToken: Map<symbol, InterceptorMetadata>;
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
			const metadata = metadataByToken.get(current.token.stateSymbol);

			if (metadata === undefined) {
				return invoke(index + 1, next);
			}

			return current.intercept({
				target,
				methodName,
				args,
				moduleName,
				metadata: metadata.method,
				decoratorState: metadata.state,
				proceed: () => invoke(index + 1, next),
			});
		};

		return invoke(0, proceed);
	}
}
