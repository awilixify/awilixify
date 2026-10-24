import { type AwilixContainer, Lifetime } from "awilix";

import * as ERRORS from "../errors.js";
import { ShutdownHook } from "../lifecycle-hooks.js";
import type { InternalModuleLike as M } from "../modules/runtime-module.types.js";
import * as GUARDS from "../type-guards.js";

type EnsureImportedModulesUniquenessParams = {
	module: M;
	resolvedImports: M[];
	globalModules: M[];
};

type EnsureGlobalModulesDoNotImportGlobalModulesParams = {
	globalModules: readonly M[];
	globalModuleImports: readonly {
		module: M;
		importedModule: M;
	}[];
};

type EnsureNoProviderNameConflictsParams = {
	module: M;
	resolvedImports: M[];
	globalModules: M[];
	getExportedProviderKeys(module: M): string[];
};

type EnsureCircularDependencyHasForwardRefParams = {
	module: M;
	moduleChain: M[];
	forwardRefModules: WeakSet<M>;
};

export class ModuleGraphEnsurer {
	ensureEagerProvidersUseSingletonLifetime({
		module,
		scope,
	}: {
		module: M;
		scope: AwilixContainer;
	}): void {
		for (const [key, provider] of Object.entries(module.providers || {})) {
			if (!GUARDS.isEagerProvider(provider)) continue;
			if (scope.registrations[key]?.lifetime === Lifetime.SINGLETON) continue;

			throw new ERRORS.EagerProviderRequiresSingletonLifetimeError(
				module.name,
				key,
			);
		}
	}

	ensureShutdownHooksUseSingletonLifetime({
		module,
		scope,
	}: {
		module: M;
		scope: AwilixContainer;
	}): void {
		for (const [key, provider] of Object.entries(module.providers || {})) {
			if (scope.registrations[key]?.lifetime === Lifetime.SINGLETON) continue;

			const useClass = GUARDS.hasUseClass(provider)
				? provider.useClass
				: GUARDS.isCostructorProvider(provider)
					? provider
					: undefined;

			if (
				useClass &&
				Object.values(ShutdownHook).some((hook) =>
					GUARDS.hasProviderShutdownHook(useClass.prototype, hook),
				)
			) {
				throw new ERRORS.ShutdownHookRequiresSingletonLifetimeError(
					module.name,
					key,
				);
			}
		}
	}

	ensureImportedModulesUniqueness({
		module,
		resolvedImports,
		globalModules,
	}: EnsureImportedModulesUniquenessParams): void {
		const importedNames = new Set<string>();
		const imports = [...globalModules, ...resolvedImports];

		for (const imported of imports) {
			if (importedNames.has(imported.name)) {
				throw new ERRORS.DuplicateModuleImportError(module.name, imported.name);
			}

			importedNames.add(imported.name);
		}
	}

	ensureGlobalModulesDoNotImportGlobalModules({
		globalModules,
		globalModuleImports,
	}: EnsureGlobalModulesDoNotImportGlobalModulesParams): void {
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

	ensureNoProviderNameConflicts({
		module,
		resolvedImports,
		globalModules,
		getExportedProviderKeys,
	}: EnsureNoProviderNameConflictsParams): void {
		const moduleProviderKeys = Object.keys(module.providers || {});

		const importConflicts = [
			...globalModules.flatMap((globalModule) =>
				getExportedProviderKeys(globalModule),
			),
			...resolvedImports.flatMap((importItem) =>
				getExportedProviderKeys(importItem),
			),
		].filter((key) => moduleProviderKeys.includes(key));

		if (importConflicts.length > 0) {
			throw new ERRORS.ProviderNameConflictError(module.name, importConflicts);
		}
	}

	ensureCircularDependencyHasForwardRef({
		module,
		moduleChain,
		forwardRefModules,
	}: EnsureCircularDependencyHasForwardRefParams): void {
		const hasForwardRefInCycle =
			forwardRefModules.has(module) ||
			moduleChain.some((chainModule) => forwardRefModules.has(chainModule));

		if (hasForwardRefInCycle) return;

		const chainNames = moduleChain.map((chainModule) => chainModule.name);
		throw new ERRORS.CircularModuleDependencyError(module.name, chainNames);
	}

	ensureSingleDevtoolsModule(devtoolsModules: M[]): M | undefined {
		if (devtoolsModules.length <= 1) return devtoolsModules[0];

		throw new ERRORS.DuplicateDevtoolsModuleError(
			devtoolsModules.map((module) => module.name),
		);
	}
}
