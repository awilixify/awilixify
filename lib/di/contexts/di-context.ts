import * as ERRORS from "../errors.js";
import {
	configuredModuleSymbolKey,
	isConfiguredModule,
} from "../modules/configure-module.js";
import type { InternalModuleLike as M } from "../modules/runtime-module.types.js";
import { isPromiseLike } from "../type-guards.js";
import type { DiContextOptions } from "./di-context-base.js";
import { DIContextBase } from "./di-context-base.js";

export class DIContext extends DIContextBase {
	private readonly configuredModules = new WeakMap<M, M>();
	private readonly configuringModules = new WeakSet<M>();

	private constructor(options: DiContextOptions) {
		super(options);
	}

	static create(module: M, options?: DiContextOptions) {
		if (isConfiguredModule(module)) {
			throw new ERRORS.ConfiguredModuleAsRootError(module.name);
		}

		return new DIContext(options ?? {}).bootstrapModule(module);
	}

	private resolveConfiguredModule(module: M): M {
		if (!isConfiguredModule(module)) return module;

		const cached = this.configuredModules.get(module);

		if (cached) return cached;

		if (this.configuringModules.has(module)) {
			throw new ERRORS.CircularModuleConfigurationDependencyError(module.name);
		}

		this.configuringModules.add(module);

		try {
			const configuration = module[configuredModuleSymbolKey];
			// Register an imports-only module to resolve factory dependencies from its imports' exports.
			const configurationModule: M = {
				name: module.name,
				imports: configuration.imports as M["imports"],
			};
			const { scope } = this.registerModuleWithScope(
				configurationModule,
				this.createContainer(configurationModule),
				[],
			);

			const args = configuration.inject.map((key) => {
				if (!scope.hasRegistration(key)) {
					throw new ERRORS.ModuleConfigurationDependencyNotFoundError(
						module.name,
						key,
					);
				}
				return scope.resolve(key);
			});

			const result = configuration.useFactory(...args);

			if (isPromiseLike(result)) {
				throw new ERRORS.AsyncModuleConfigurationFactoryError(module.name);
			}

			if (!result || typeof result.name !== "string") {
				throw new ERRORS.InvalidModuleConfigurationFactoryResultError(
					module.name,
				);
			}

			// Resolve chained configuration when the factory returns another configureModule descriptor.
			const resolved = this.resolveConfiguredModule(result);
			this.configuredModules.set(module, resolved);

			return resolved;
		} finally {
			this.configuringModules.delete(module);
		}
	}

	protected resolveImports(module: M): M[] {
		return super
			.resolveImports(module)
			.map((imported) => this.resolveConfiguredModule(imported));
	}

	protected get globalModules(): M[] {
		return super.globalModules.map((module) =>
			this.resolveConfiguredModule(module),
		);
	}
}
