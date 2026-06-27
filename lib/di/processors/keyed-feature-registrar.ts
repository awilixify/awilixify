import * as Awilix from "awilix";
import type { DevtoolsProcessorRef } from "../../devtools/devtools.types.js";
import type { RegisteredModuleScope } from "../contexts/container-context-base.js";
import * as ERRORS from "../errors.js";
import type { InternalModuleLike as M } from "../modules/runtime-module.types.js";
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

export class KeyedFeatureRegistrar {
	constructor(
		private readonly providerOptions: Partial<Awilix.BuildResolverOptions<any>>,
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
		const ownerByKey = new Map<string, string>();
		const resolverMap = new Map<string, () => T>();
		const ownerByInitializerToken = new Map<symbol, string>();
		const config = this.featureConfig[featureKind];
		const providerResolver = new ProviderResolver(
			undefined,
			this.getProviderOptions(featureKind),
			{},
			getOrCreateRequestScope,
		);

		for (const {
			module: importedModule,
			moduleScope: importedModuleScope,
		} of importedModulesWithScope) {
			for (const key of importedModule[config.exportKey] ?? []) {
				const feature = importedModule[featureKind]?.[key];

				if (!feature) {
					throw new ERRORS.InvalidProviderDefinitionError(
						importedModule.name,
						key,
					);
				}

				if (ownerByKey.has(key)) {
					throw new ERRORS.FeatureNameConflictError(
						module.name,
						config.featureName,
						key,
						ownerByKey.get(key) ?? importedModule.name,
					);
				}

				const symbol = Symbol(
					`${featureKind}_export_${importedModule.name}_${key}`,
				);
				scope.register({
					[symbol]: this.createFeatureResolver({
						feature,
						featureKind,
						key,
						module: importedModule,
						providerResolver,
						resolutionScope: importedModuleScope.scope,
						wrapForExport: true,
					}),
				});

				if (featureKind === "initializers") {
					this.ensureInitializerTokenUniqueness({
						scope,
						symbol,
						ownerByInitializerToken,
						moduleName: module.name,
						featureName: feature.name || key,
					});
				}

				resolverMap.set(
					key,
					featureKind === "initializers"
						? () => scope.resolve<T>(symbol)
						: () => resolveFromRequestScope<T>(scope, symbol),
				);
				ownerByKey.set(key, importedModule.name);
			}
		}

		for (const [key, feature] of Object.entries(module[featureKind] ?? {})) {
			if (ownerByKey.has(key)) {
				throw new ERRORS.FeatureNameConflictError(
					module.name,
					config.featureName,
					key,
					ownerByKey.get(key) ?? module.name,
				);
			}

			const symbol = Symbol(`${featureKind}_${module.name}_${key}`);
			scope.register({
				[symbol]: this.createFeatureResolver({
					feature,
					featureKind,
					key,
					module,
					providerResolver,
					resolutionScope: scope,
				}),
			});

			if (featureKind === "initializers") {
				this.ensureInitializerTokenUniqueness({
					scope,
					symbol,
					ownerByInitializerToken,
					moduleName: module.name,
					featureName: feature.name || key,
				});
			}

			resolverMap.set(
				key,
				featureKind === "initializers"
					? () => scope.resolve<T>(symbol)
					: () => resolveFromRequestScope<T>(scope, symbol),
			);
			ownerByKey.set(key, module.name);
		}

		return resolverMap;
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
