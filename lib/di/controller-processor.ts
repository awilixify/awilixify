import * as Awilix from "awilix";
import * as ERRORS from "./errors.js";
import type { ConstructorController, Controller } from "./provider.types.js";
import { resolveFromRequestScope } from "./request-scope-context.js";
import type { InternalModuleLike as M } from "./runtime-module.types.js";
import { isClassController } from "./type-guards.js";
import type { ControllerRuntimeEntry } from "./initializer-processor.js";

export class ControllerProcessor {
	private readonly registeredControllers = new WeakMap<
		ConstructorController,
		M
	>();

	constructor(
		private readonly providerOptions: Partial<Awilix.BuildResolverOptions<any>>,
	) {}

	public processControllers(
		m: M,
		diScope: Awilix.AwilixContainer,
	): ControllerRuntimeEntry[] {
		if (!m.controllers?.length) return [];
		if (m.registerControllers === false) return [];
		const runtimeEntries: ControllerRuntimeEntry[] = [];

		if (new Set(m.controllers).size !== m.controllers.length) {
			throw new ERRORS.DuplicateControllersInModuleError(m.name);
		}

		for (const c of m.controllers) {
			const { useClass, ...awilixOptions } = isClassController(c)
				? c
				: { useClass: c };
			const existingModule = this.registeredControllers.get(useClass);

			if (!existingModule) {
				this.registeredControllers.set(useClass, m);

				const controllerSymbol = Symbol(`controller_${useClass.name}`);
				const options = {
					...this.providerOptions,
					...m.providerOptions,
					...awilixOptions,
				};
				const isWithNewScope = options.lifetime !== Awilix.Lifetime.SINGLETON;

				diScope.register({
					[controllerSymbol]: Awilix.asClass(useClass, {
						...options,
						...(isWithNewScope && {
							injector: () => ({
								resolveSelf: () =>
									this.resolveBySymbol(
										controllerSymbol,
										diScope,
										isWithNewScope,
									),
							}),
						}),
					}),
				});

				const controllerInstance = this.resolveBySymbol(
					controllerSymbol,
					diScope,
					false,
				);

				if (controllerInstance.registerRoutes) {
					controllerInstance.registerRoutes();
				}

				const resolveController = () =>
					this.resolveBySymbol(controllerSymbol, diScope, isWithNewScope);

				runtimeEntries.push({
					controllerClass: useClass,
					resolve: resolveController,
				});

				continue;
			}

			if (existingModule === m) {
				continue;
			}

			throw new ERRORS.ControllerAlreadyRegisteredError(
				useClass.name,
				existingModule.name,
			);
		}

		return runtimeEntries;
	}

	private resolveBySymbol(
		symbol: symbol,
		scope: Awilix.AwilixContainer,
		withNewScope: boolean,
	): Controller {
		if (withNewScope) return resolveFromRequestScope(scope, symbol);

		return scope.resolve(symbol);
	}
}
