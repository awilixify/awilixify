import * as Awilix from "awilix";
import {
	resolveControllerMethodMetadata,
	type ControllerMetadataToken,
} from "../decorators/controller-initializer-state.js";
import * as ERRORS from "./errors.js";
import type {
	AnyInitializer,
	Initializer,
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

export class InitializerProcessor {
	private readonly resolversByModule = new WeakMap<
		M,
		Array<() => Initializer<any>>
	>();

	public processInitializers(
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
		const resolvers: Array<() => Initializer<any>> = [];
		const seen = new Set<AnyInitializer>();

		for (const {
			module: importedModule,
			scope: importedScope,
		} of importedModulesWithScope) {
			for (const initializerKey of importedModule.initializerExports || []) {
				const initializer = importedModule.initializers?.[initializerKey];
				if (!initializer) continue;

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

		for (const initializer of Object.values(m.initializers || {})) {
			if (seen.has(initializer)) {
				throw new ERRORS.InitializerConflictError(m.name);
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
		initializer: AnyInitializer;
		resolutionScope: Awilix.AwilixContainer;
		wrapForExport?: boolean;
	}): Awilix.Resolver<Initializer<any>> {
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
		const collected = new Set<string | symbol>();
		let proto = controllerClass.prototype;

			while (proto && proto !== Object.prototype) {
				Object.getOwnPropertyNames(proto)
					.filter(
						(name) => name !== "constructor" && typeof proto[name] === "function",
					)
					.forEach((name) => {
						collected.add(name);
					});

				Object.getOwnPropertySymbols(proto)
					.filter((symbol) => typeof proto[symbol] === "function")
					.forEach((symbol) => {
						collected.add(symbol);
					});

			proto = Object.getPrototypeOf(proto);
		}

		return [...collected];
	}
}
