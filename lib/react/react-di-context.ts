import * as Awilix from "awilix";
import {
	ContainerContextBase,
	type ContainerContextOptions,
	type ModuleScope,
	type RegisteredModuleScope,
} from "../di/contexts/container-context-base.js";
import type { InternalModuleLike as M } from "../di/modules/runtime-module.types.js";
import { ProviderResolver } from "../di/providers/provider-resolver.js";
import * as REACT_ERRORS from "./errors.js";
import { ReactComponentProcessor } from "./react-component-processor.js";
import type { NonScopedResolverOptions } from "./react-module.types.js";

type ReactContainerContextOptions = ContainerContextOptions<
	NonScopedResolverOptions<any>
>;

export class ReactDIContext extends ContainerContextBase {
	private readonly componentProcessor = new ReactComponentProcessor();

	private constructor(options: ReactContainerContextOptions) {
		super(options);
		this.providerResolver = new ProviderResolver(
			undefined,
			this.options.providerOptions || {},
			{},
		);
	}

	static create(
		module: M,
		options?: ReactContainerContextOptions,
	): ModuleScope {
		return new ReactDIContext(options ?? {}).bootstrapModule(module);
	}

	protected registerImportedFeatures(
		scope: Awilix.AwilixContainer,
		importedModulesWithScope: RegisteredModuleScope[],
	): void {
		this.registerExportedProviders(scope, importedModulesWithScope);
		this.componentProcessor.registerExportedComponents(
			scope,
			importedModulesWithScope,
		);
	}

	protected ensureAdditionalNameConflicts(m: M, resolvedImports: M[]): void {
		const componentKeys = Object.keys(m.components || {});
		const providerConflicts = Object.keys(m.providers || {}).filter((key) =>
			componentKeys.includes(key),
		);
		const importComponentConflicts = [
			...this.globalModulesWithScope.flatMap(({ module: globalModule }) =>
				this.componentProcessor.getExportedComponentKeys(globalModule),
			),
			...resolvedImports.flatMap((importItem) =>
				this.componentProcessor.getExportedComponentKeys(importItem),
			),
		].filter((key) => componentKeys.includes(key));

		const conflicts = [...providerConflicts, ...importComponentConflicts];

		if (conflicts.length > 0) {
			throw new REACT_ERRORS.ComponentNameConflictError(m.name, conflicts);
		}
	}

	protected beforeRegisterProviders(m: M): void {
		if (
			m.providerOptions?.lifetime === Awilix.Lifetime.SCOPED ||
			this.options.providerOptions?.lifetime === Awilix.Lifetime.SCOPED
		) {
			throw new REACT_ERRORS.ScopedProviderLifetimeError(
				m.name,
				"providerOptions",
			);
		}

		for (const [key, provider] of Object.entries(m.providers || {})) {
			if (this.hasScopedProviderLifetime(provider)) {
				throw new REACT_ERRORS.ScopedProviderLifetimeError(m.name, key);
			}
		}
	}

	protected afterRegisterProviders(m: M, scope: Awilix.AwilixContainer): void {
		this.componentProcessor.processComponents(m, scope);
	}

	private hasScopedProviderLifetime(provider: unknown): boolean {
		return (
			typeof provider === "object" &&
			provider !== null &&
			("useClass" in provider || "useFactory" in provider) &&
			"lifetime" in provider &&
			provider.lifetime === Awilix.Lifetime.SCOPED
		);
	}
}
