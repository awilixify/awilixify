import * as Awilix from "awilix";
import * as ERRORS from "../errors.js";
import type { InternalModuleLike as M } from "../modules/runtime-module.types.js";
import { ProviderResolver } from "../providers/provider-resolver.js";
import { resolveFromRequestScope } from "../request-scope-context.js";

type ModuleWithScope = {
	module: M;
	scope: Awilix.AwilixContainer;
};

type KeyedFeatureKind =
	| "queryPreHandlers"
	| "commandPreHandlers"
	| "interceptors"
	| "initializers";

type RegisterKeyedFeatureParams = {
	featureKind: KeyedFeatureKind;
	module: M;
	scope: Awilix.AwilixContainer;
	importedModulesWithScope: ModuleWithScope[];
};

export class KeyedFeatureRegistrar {
	constructor(
		private readonly providerOptions: Partial<Awilix.BuildResolverOptions<any>>,
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
		const config = this.featureConfig[featureKind];

		for (const {
			module: importedModule,
			scope: importedScope,
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
					[symbol]: ProviderResolver.resolveClassProvider({
						provider: feature,
						resolutionScope: importedScope,
						module: importedModule,
						providerOptions: this.getProviderOptions(featureKind),
						wrapForExport: true,
					}),
				});

				resolverMap.set(key, () => resolveFromRequestScope<T>(scope, symbol));
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
				[symbol]: ProviderResolver.resolveClassProvider({
					provider: feature,
					resolutionScope: scope,
					module,
					providerOptions: this.getProviderOptions(featureKind),
				}),
			});

			resolverMap.set(key, () => resolveFromRequestScope<T>(scope, symbol));
			ownerByKey.set(key, module.name);
		}

		return resolverMap;
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
}
