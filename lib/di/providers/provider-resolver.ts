import * as Awilix from "awilix";
import type { DevtoolsProcessorRef } from "../../devtools/devtools.types.js";
import * as ERRORS from "../errors.js";
import type { InternalModuleLike as M } from "../modules/runtime-module.types.js";
import type { InterceptorProcessor } from "../processors/interceptor-processor.js";
import * as GUARGS from "../type-guards.js";
import type { AnyProvider } from "./provider.types.js";

export type RequestScopeResolver = (
	scope: Awilix.AwilixContainer,
) => Awilix.AwilixContainer;

type ResolveProviderParams = {
	key: string;
	moduleId?: string;
	provider: AnyProvider;
	resolutionScope: Awilix.AwilixContainer;
	module: M;
};

type ResolveClassProviderParams = {
	provider: unknown;
	resolutionScope: Awilix.AwilixContainer;
	module: M;
	providerOptions?: Partial<Awilix.BuildResolverOptions<any>>;
	wrapForExport?: boolean;
};

export class ProviderResolver {
	constructor(
		private readonly interceptorProcessor: InterceptorProcessor | undefined,
		private readonly providerOptions: Partial<Awilix.BuildResolverOptions<any>>,
		private readonly devtoolsProcessorRef: DevtoolsProcessorRef,
		private readonly requestScopeResolver?: RequestScopeResolver,
	) {}

	static mergeResolverOptions(
		module: M,
		providerOptions: Partial<Awilix.BuildResolverOptions<any>>,
		options?: Partial<Awilix.BuildResolverOptions<any>>,
	): Awilix.BuildResolverOptions<any> {
		return {
			...providerOptions,
			...module.providerOptions,
			...options,
		};
	}

	public resolveClassProvider({
		provider,
		resolutionScope,
		module,
		wrapForExport,
	}: ResolveClassProviderParams): Awilix.Resolver<any> {
		const { useClass, ...featureOptions } = GUARGS.hasUseClass<any>(provider)
			? provider
			: { useClass: provider as Awilix.Constructor<any> };

		const resolverOptions: Awilix.BuildResolverOptions<any> = {
			...this.providerOptions,
			...module.providerOptions,
			...featureOptions,
		};
		const resolver = Awilix.asClass(useClass, resolverOptions);

		if (!wrapForExport) return resolver;

		return Awilix.asFunction(
			() =>
				resolver.resolve(
					resolverOptions.lifetime === Awilix.Lifetime.SINGLETON
						? resolutionScope
						: this.requestScopeResolver
							? this.requestScopeResolver(resolutionScope)
							: resolutionScope,
				),
			resolverOptions,
		);
	}

	resolveProvider({
		key,
		moduleId,
		provider,
		resolutionScope,
		module,
	}: ResolveProviderParams): Awilix.Resolver<any> {
		if (GUARGS.isPrimitive(provider)) {
			return Awilix.asValue(provider);
		}

		if (
			GUARGS.isPlainFunction(provider) &&
			!GUARGS.isCostructorProvider(provider)
		) {
			return Awilix.asValue(provider);
		}

		if (
			typeof provider === "object" &&
			!GUARGS.isCostructorProvider(provider) &&
			!GUARGS.isFactoryProvider(provider) &&
			!GUARGS.hasUseClass(provider)
		) {
			return Awilix.asValue(provider);
		}

		const resolverOptions = this.extractResolverOptions(module, provider);

		if (GUARGS.isCostructorProvider(provider)) {
			const baseResolver = Awilix.asClass(provider, resolverOptions);
			const tracedResolver = !this.devtoolsTracer
				? baseResolver
				: this.devtoolsTracer.wrapResolver({
						kind: "provider",
						module,
						moduleId,
						options: resolverOptions,
						className: provider.name,
						registrationKey: key,
						resolver: baseResolver,
					});

			if (!this.interceptorProcessor) return tracedResolver;

			return this.interceptorProcessor.createInterceptedProviderResolver({
				module,
				useClass: provider,
				options: resolverOptions,
				resolver: tracedResolver,
			});
		}

		if (GUARGS.isFactoryProvider(provider)) {
			if (GUARGS.isAsyncFactoryProvider(provider)) {
				if (GUARGS.isEagerProvider(provider)) {
					return Awilix.asFunction(() => {
						throw new ERRORS.AsyncEagerFactoryRequiresInitError(
							module.name,
							key ?? "unknown",
						);
					}, resolverOptions);
				}

				throw new ERRORS.AsyncFactoryRequiresAsyncCreateError(
					module.name,
					key ?? "unknown",
				);
			}

			const factoryDeps = (provider.inject || []).map((k) =>
				// biome-ignore lint/style/noNonNullAssertion: dependencies are validated by ProviderDependencySorter
				resolutionScope.registrations[k]!.resolve(resolutionScope),
			);

			const resolver = Awilix.asFunction(
				() => provider.useFactory(...factoryDeps),
				resolverOptions,
			);

			if (!this.devtoolsTracer) return resolver;

			return this.devtoolsTracer.wrapResolver({
				kind: "provider",
				module,
				moduleId,
				options: resolverOptions,
				className: key,
				registrationKey: key,
				isFactory: true,
				resolver,
			});
		}

		const baseResolver = Awilix.asClass(provider.useClass, resolverOptions);
		const classResolver = provider.allowCircular
			? this.createProxyResolver(baseResolver, resolverOptions)
			: baseResolver;
		const tracedResolver = !this.devtoolsTracer
			? classResolver
			: this.devtoolsTracer.wrapResolver({
					kind: "provider",
					module,
					moduleId,
					options: resolverOptions,
					className: provider.useClass.name,
					registrationKey: key,
					resolver: classResolver,
				});

		if (!this.interceptorProcessor) return tracedResolver;

		return this.interceptorProcessor.createInterceptedProviderResolver({
			module,
			useClass: provider.useClass,
			options: resolverOptions,
			resolver: tracedResolver,
		});
	}

	async resolveProviderAsync({
		key,
		moduleId,
		provider,
		resolutionScope,
		module,
	}: ResolveProviderParams): Promise<Awilix.Resolver<any>> {
		if (
			!GUARGS.isFactoryProvider(provider) ||
			!GUARGS.isAsyncFactoryProvider(provider)
		) {
			return this.resolveProvider({
				provider,
				resolutionScope,
				module,
				key,
				moduleId,
			});
		}

		const resolverOptions = this.extractResolverOptions(module, provider);

		if (resolverOptions.lifetime !== Awilix.Lifetime.SINGLETON) {
			throw new ERRORS.AsyncFactoryRequiresSingletonLifetimeError(
				module.name,
				key,
			);
		}

		const factoryDeps = (provider.inject || []).map((k) =>
			// biome-ignore lint/style/noNonNullAssertion: dependencies are validated by ProviderDependencySorter
			resolutionScope.registrations[k]!.resolve(resolutionScope),
		);

		// biome-ignore lint/correctness/useHookAtTopLevel: useFactory is a provider option, not a React hook.
		return Awilix.asValue(await provider.useFactory(...factoryDeps));
	}

	private extractResolverOptions(
		module: M,
		provider: AnyProvider,
	): Awilix.BuildResolverOptions<any> {
		if (GUARGS.hasUseClass(provider)) {
			const { useClass, allowCircular, eager, initAfter, ...options } =
				provider;

			return ProviderResolver.mergeResolverOptions(
				module,
				this.providerOptions,
				options,
			);
		}

		if (GUARGS.isFactoryProvider(provider)) {
			const { eager, initAfter, inject, useFactory, ...options } = provider;

			return ProviderResolver.mergeResolverOptions(
				module,
				this.providerOptions,
				options,
			);
		}

		return ProviderResolver.mergeResolverOptions(module, this.providerOptions);
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

	private get devtoolsTracer() {
		return this.devtoolsProcessorRef.current?.tracer;
	}
}
