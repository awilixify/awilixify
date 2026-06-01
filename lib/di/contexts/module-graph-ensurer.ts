import * as ERRORS from "../errors.js";
import type { InternalModuleLike as M } from "../modules/runtime-module.types.js";

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
