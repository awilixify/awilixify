import * as Awilix from "awilix";
import type { DevtoolsProcessorRef } from "../../devtools/devtools.types.js";
import type { RegisteredModuleScope } from "../contexts/container-context-base.js";
import * as ERRORS from "../errors.js";
import type { InternalModuleLike as M } from "../modules/runtime-module.types.js";
import type { InquirerResolverFactory } from "../providers/inquirer-resolver-factory.js";
import type { Initializer } from "../providers/provider.types.js";
import { ProviderResolver } from "../providers/provider-resolver.js";
import {
	getOrCreateRequestScope,
	resolveFromRequestScope,
} from "../request-scope-context.js";
import { hasUseClass } from "../type-guards.js";

type KeyedFeatureKind =
	| "queryPreHandlers"
	| "commandPreHandlers"
	| "interceptors"
	| "initializers";

type RegisterKeyedFeatureParams = {
	featureKind: KeyedFeatureKind;
	module: M;
	scope: Awilix.AwilixContainer;
	importedModulesWithScope: RegisteredModuleScope[];
};

type FeatureRegistrationContext<T> = Pick<
	RegisterKeyedFeatureParams,
	"featureKind" | "module" | "scope"
> & {
	config: KeyedFeatureRegistrar["featureConfig"][KeyedFeatureKind];
	providerResolver: ProviderResolver;
	ownerByKey: Map<string, string>;
	resolverMap: Map<string, () => T>;
	ownerByInitializerToken: Map<symbol, string>;
};

type RegisterFeatureParams = {
	key: string;
	feature: NonNullable<M[KeyedFeatureKind]>[string];
	ownerModule: M;
	resolutionScope: Awilix.AwilixContainer;
	wrapForExport?: boolean;
};

export class KeyedFeatureRegistrar {
	constructor(
		private readonly providerOptions: Partial<Awilix.BuildResolverOptions<any>>,
		private readonly inquirerResolverFactory: InquirerResolverFactory,
		private readonly devtoolsProcessorRef: DevtoolsProcessorRef = {},
	) {}

	private readonly featureConfig = {
		queryPreHandlers: {
			exportKey: "queryPreHandlerExports",
			featureName: "pre-handler",
		},
		commandPreHandlers: {
			exportKey: "commandPreHandlerExports",
			featureName: "pre-handler",
		},
		interceptors: {
			exportKey: "interceptorExports",
			featureName: "interceptor",
		},
		initializers: {
			exportKey: "initializerExports",
			featureName: "initializer",
		},
	} as const;

	register<T>({
		featureKind,
		module,
		scope,
		importedModulesWithScope,
	}: RegisterKeyedFeatureParams): Map<string, () => T> {
		const context: FeatureRegistrationContext<T> = {
			config: this.featureConfig[featureKind],
			featureKind,
			module,
			scope,
			providerResolver: new ProviderResolver(
				undefined,
				this.getProviderOptions(featureKind),
				getOrCreateRequestScope,
				this.inquirerResolverFactory,
			),
			ownerByKey: new Map<string, string>(),
			resolverMap: new Map<string, () => T>(),
			ownerByInitializerToken: new Map<symbol, string>(),
		};

		for (const {
			module: importedModule,
			moduleScope: importedModuleScope,
		} of importedModulesWithScope) {
			for (const key of importedModule[context.config.exportKey] ?? []) {
				const feature = importedModule[featureKind]?.[key];

				if (!feature) {
					throw new ERRORS.InvalidProviderDefinitionError(
						importedModule.name,
						key,
					);
				}

				this.registerFeature(context, {
					key,
					feature,
					ownerModule: importedModule,
					resolutionScope: importedModuleScope.scope,
					wrapForExport: true,
				});
			}
		}

		for (const [key, feature] of Object.entries(module[featureKind] ?? {})) {
			this.registerFeature(context, {
				key,
				feature,
				ownerModule: module,
				resolutionScope: scope,
			});
		}

		return context.resolverMap;
	}

	private registerFeature<T>(
		context: FeatureRegistrationContext<T>,
		params: RegisterFeatureParams,
	): void {
		if (context.ownerByKey.has(params.key)) {
			throw new ERRORS.FeatureNameConflictError(
				context.module.name,
				context.config.featureName,
				params.key,
				context.ownerByKey.get(params.key) ?? params.ownerModule.name,
			);
		}

		const symbol = Symbol(
			params.wrapForExport
				? `${context.featureKind}_export_${params.ownerModule.name}_${params.key}`
				: `${context.featureKind}_${params.ownerModule.name}_${params.key}`,
		);
		context.scope.register({
			[symbol]: this.createFeatureResolver({
				feature: params.feature,
				featureKind: context.featureKind,
				key: params.key,
				module: params.ownerModule,
				providerResolver: context.providerResolver,
				resolutionScope: params.resolutionScope,
				wrapForExport: params.wrapForExport,
			}),
		});

		if (context.featureKind === "initializers") {
			this.ensureInitializerTokenUniqueness({
				scope: context.scope,
				symbol,
				ownerByInitializerToken: context.ownerByInitializerToken,
				moduleName: context.module.name,
				featureName: params.feature.name || params.key,
			});
		}

		context.resolverMap.set(
			params.key,
			context.featureKind === "initializers"
				? () => context.scope.resolve<T>(symbol)
				: () => resolveFromRequestScope<T>(context.scope, symbol),
		);
		context.ownerByKey.set(params.key, params.ownerModule.name);
	}

	private createFeatureResolver({
		feature,
		featureKind,
		key,
		module,
		providerResolver,
		resolutionScope,
		wrapForExport = false,
	}: {
		feature: NonNullable<M[KeyedFeatureKind]>[string];
		featureKind: KeyedFeatureKind;
		key: string;
		module: M;
		providerResolver: ProviderResolver;
		resolutionScope: Awilix.AwilixContainer;
		wrapForExport?: boolean;
	}): Awilix.Resolver<any> {
		const resolver = providerResolver.resolveClassProvider({
			provider: feature,
			resolutionScope,
			module,
			wrapForExport,
		});

		if (!isPreHandlerFeature(featureKind) || !this.devtoolsTracer) {
			return resolver;
		}

		return this.devtoolsTracer.wrapResolver({
			kind: "prehandler",
			module,
			options: this.getProviderOptions(featureKind),
			className: getFeatureClassName(feature, key),
			registrationKey: key,
			resolver,
		});
	}

	private get devtoolsTracer() {
		return this.devtoolsProcessorRef.current?.tracer;
	}

	private getProviderOptions(
		featureKind: KeyedFeatureKind,
	): Partial<Awilix.BuildResolverOptions<any>> {
		if (featureKind === "initializers") {
			return {
				lifetime: Awilix.Lifetime.SINGLETON,
			};
		}

		return this.providerOptions;
	}

	private ensureInitializerTokenUniqueness({
		scope,
		symbol,
		ownerByInitializerToken,
		moduleName,
		featureName,
	}: {
		scope: Awilix.AwilixContainer;
		symbol: symbol;
		ownerByInitializerToken: Map<symbol, string>;
		moduleName: string;
		featureName: string;
	}): void {
		const initializer = scope.resolve<Initializer>(symbol);
		const token = initializer.token.stateSymbol;
		const existingModuleName = ownerByInitializerToken.get(token);

		if (existingModuleName) {
			throw new ERRORS.DuplicateInitializerTokenError(
				moduleName,
				featureName,
				existingModuleName,
			);
		}

		ownerByInitializerToken.set(token, moduleName);
	}
}

function isPreHandlerFeature(featureKind: KeyedFeatureKind): boolean {
	return (
		featureKind === "queryPreHandlers" || featureKind === "commandPreHandlers"
	);
}

function getFeatureClassName(
	feature: NonNullable<M[KeyedFeatureKind]>[string],
	key: string,
): string {
	if (typeof feature === "function") return feature.name || key;
	if (hasUseClass(feature)) return feature.useClass.name || key;

	return key;
}
