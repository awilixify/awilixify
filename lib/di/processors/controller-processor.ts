import * as Awilix from "awilix";
import * as ERRORS from "../errors.js";
import type { InternalModuleLike as M } from "../modules/runtime-module.types.js";
import type {
	ConstructorController,
	Controller,
} from "../providers/provider.types.js";
import { resolveFromRequestScope } from "../request-scope-context.js";
import { hasUseClass } from "../type-guards.js";
import type { ControllerRuntimeEntry } from "./initializer-processor.js";
import type { InterceptorProcessor } from "./interceptor-processor.js";

export class ControllerProcessor {
	private readonly registeredControllers = new WeakMap<
		ConstructorController,
		M
	>();

	constructor(
		private readonly interceptorProcessor: InterceptorProcessor,
		private readonly providerOptions: Partial<Awilix.BuildResolverOptions<any>>,
		private readonly skipRegisterRoutes: boolean,
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
			const { useClass, ...awilixOptions } = hasUseClass<Controller>(c)
				? c
				: { useClass: c as ConstructorController };
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
				const baseResolver = Awilix.asClass(useClass, {
					...options,
					...(isWithNewScope && {
						injector: () => ({
							resolveSelf: () =>
								this.resolveBySymbol(controllerSymbol, diScope, isWithNewScope),
						}),
					}),
				});

				diScope.register({
					[controllerSymbol]:
						this.interceptorProcessor.createInterceptedProviderResolver({
							module: m,
							useClass,
							options,
							resolver: baseResolver,
						}),
				});

				if (
					!this.skipRegisterRoutes &&
					typeof useClass.prototype.registerRoutes === "function"
				) {
					// Route registration happens during bootstrap before eager provider
					// init hooks run. Use the raw controller instance here so imported
					// interceptors are not resolved just to execute registerRoutes().
					baseResolver.resolve(diScope).registerRoutes();
				}

				runtimeEntries.push({
					controllerClass: useClass,
					resolve: () =>
						this.resolveBySymbol(controllerSymbol, diScope, isWithNewScope),
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
