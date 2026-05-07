import * as Awilix from "awilix";
import {
	resolveControllerMethodMetadata,
	type ControllerMetadataToken,
} from "../decorators/controller-initializer-state.js";
import * as ERRORS from "./errors.js";
import type {
	AnyControllerInitializer,
	ControllerInitializer,
	ConstructorController,
} from "./provider.types.js";
import type { InternalModuleLike as M } from "./runtime-module.types.js";

export type ControllerRuntimeEntry = {
	controllerClass: ConstructorController;
	resolve: () => any;
};

type ModuleWithScope = {
	module: M;
	scope: Awilix.AwilixContainer;
};

export class ControllerInitializerProcessor {
	private readonly resolversByModule = new WeakMap<
		M,
		Array<() => ControllerInitializer<any>>
	>();

	public processControllerInitializers(
		m: M,
		scope: Awilix.AwilixContainer,
		importedModulesWithScope: ModuleWithScope[],
		controllers: ControllerRuntimeEntry[],
	): void {
		this.processInitializerResolvers(m, scope, importedModulesWithScope);

		const initializers = this.resolversByModule.get(m) ?? [];
		if (initializers.length === 0 || controllers.length === 0) return;

		for (const controller of controllers) {
			for (const methodName of this.getControllerMethodNames(
				controller.controllerClass,
			)) {
				const invoke = (...args: unknown[]) =>
					controller.resolve()[methodName](...args);

				for (const resolveInitializer of initializers) {
					const initializer = resolveInitializer();
					const metadata = resolveControllerMethodMetadata(
						controller.controllerClass,
						methodName,
						initializer.token as ControllerMetadataToken<unknown>,
					);

					for (const value of metadata) {
						void Promise.resolve(
							initializer.initialize({
								moduleName: m.name,
								controllerClass: controller.controllerClass,
								methodName,
								metadata: value,
								invoke,
							}),
						);
					}
				}
			}
		}
	}

	private processInitializerResolvers(
		m: M,
		scope: Awilix.AwilixContainer,
		importedModulesWithScope: ModuleWithScope[],
	): void {
		const resolvers: Array<() => ControllerInitializer<any>> = [];
		const seen = new Set<AnyControllerInitializer>();

		for (const {
			module: importedModule,
			scope: importedScope,
		} of importedModulesWithScope) {
			for (const initializer of importedModule.controllerInitializerExports ||
				[]) {
				if (seen.has(initializer)) continue;
				seen.add(initializer);

				const symbol = Symbol(
					`controller_initializer_export_${importedModule.name}`,
				);
				scope.register({
					[symbol]: this.resolveInitializerProvider({
						initializer,
						resolutionScope: importedScope,
						wrapForExport: true,
					}),
				});
				resolvers.push(() => scope.resolve(symbol));
			}
		}

		for (const initializer of m.controllerInitializers || []) {
			if (seen.has(initializer)) {
				throw new ERRORS.ControllerInitializerConflictError(m.name);
			}
			seen.add(initializer);

			const symbol = Symbol(`controller_initializer_${m.name}`);
			scope.register({
				[symbol]: this.resolveInitializerProvider({
					initializer,
					resolutionScope: scope,
				}),
			});
			resolvers.push(() => scope.resolve(symbol));
		}

		this.resolversByModule.set(m, resolvers);
	}

	private resolveInitializerProvider({
		initializer,
		resolutionScope,
		wrapForExport,
	}: {
		initializer: AnyControllerInitializer;
		resolutionScope: Awilix.AwilixContainer;
		wrapForExport?: boolean;
	}): Awilix.Resolver<ControllerInitializer<any>> {
		const resolverOptions = {
			lifetime: Awilix.Lifetime.SINGLETON,
		};

		const resolver = Awilix.asClass(initializer, resolverOptions);

		if (!wrapForExport) return resolver;

		return Awilix.asFunction(
			() => resolver.resolve(resolutionScope),
			resolverOptions,
		);
	}

	private getControllerMethodNames(
		controllerClass: ConstructorController,
	): Array<string | symbol> {
		const proto = controllerClass.prototype;
		if (!proto) return [];

		return [
			...Object.getOwnPropertyNames(proto).filter(
				(name) => name !== "constructor" && typeof proto[name] === "function",
			),
			...Object.getOwnPropertySymbols(proto).filter(
				(symbol) => typeof proto[symbol] === "function",
			),
		];
	}
}
