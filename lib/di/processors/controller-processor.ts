import * as Awilix from "awilix";
import type { DevtoolsProcessorRef } from "../../devtools/devtools.types.js";
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
		private readonly devtoolsProcessorRef: DevtoolsProcessorRef,
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

				// Wrap with tracer first (innermost) to record controller method spans
				const tracedResolver = this.devtoolsTracer
					? this.createTracedControllerResolver({
							module: m,
							options,
							className: useClass.name,
							registrationKey: useClass.name,
							resolver: baseResolver,
						})
					: baseResolver;

				// Wrap with interceptors (middle layer)
				const interceptedResolver =
					this.interceptorProcessor.createInterceptedProviderResolver({
						module: m,
						useClass,
						options,
						resolver: tracedResolver,
					});

				// Wrap with trace starter (outermost) to ensure trace exists before interceptors run
				const traceStarterResolver = this.devtoolsTracer
					? this.createTraceStarterResolver({
							module: m,
							options,
							className: useClass.name,
							registrationKey: useClass.name,
							resolver: interceptedResolver,
						})
					: interceptedResolver;

				diScope.register({
					[controllerSymbol]: traceStarterResolver,
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

	private get devtoolsTracer() {
		return this.devtoolsProcessorRef.current?.tracer;
	}

	/**
	 * Creates a resolver that wraps the controller with tracing at resolve time.
	 */
	private createTracedControllerResolver({
		className,
		module,
		options,
		registrationKey,
		resolver,
	}: {
		className: string;
		module: M;
		options: Awilix.BuildResolverOptions<any>;
		registrationKey: string;
		resolver: Awilix.Resolver<any>;
	}): Awilix.Resolver<any> {
		return Awilix.createBuildResolver({
			...options,
			resolve: (container) => {
				const instance = resolver.resolve(container);
				const tracer = this.devtoolsProcessorRef.current?.tracer;

				if (!tracer || module.name === "DevtoolsModule") {
					return instance;
				}

				// Use tracer's wrapResolver logic but applied to resolved instance
				return tracer
					.wrapResolver({
						kind: "controller",
						module,
						options,
						className,
						registrationKey,
						resolver: Awilix.asValue(instance),
					})
					.resolve(container);
			},
		});
	}

	/**
	 * Creates a resolver that starts a trace context before method calls.
	 * This wraps around interceptors so they can record spans within the trace.
	 */
	private createTraceStarterResolver({
		className,
		module,
		options,
		registrationKey,
		resolver,
	}: {
		className: string;
		module: M;
		options: Awilix.BuildResolverOptions<any>;
		registrationKey: string;
		resolver: Awilix.Resolver<any>;
	}): Awilix.Resolver<any> {
		return Awilix.createBuildResolver({
			...options,
			resolve: (container) => {
				const instance = resolver.resolve(container);
				const tracer = this.devtoolsProcessorRef.current?.tracer;

				if (!tracer || module.name === "DevtoolsModule") {
					return instance;
				}

				// Create a proxy that wraps method calls with trace context
				const wrappers = new Map<
					PropertyKey,
					(...args: unknown[]) => unknown
				>();

				return new Proxy(instance, {
					get: (target, propertyKey, proxyReceiver) => {
						const value = Reflect.get(target, propertyKey, proxyReceiver);

						if (typeof value !== "function") return value;
						if (propertyKey === "constructor") return value;

						const existing = wrappers.get(propertyKey);
						if (existing) return existing;

						const methodName = String(propertyKey);
						const wrapped = (...args: unknown[]) =>
							tracer.runInControllerTrace({
								moduleName: module.name,
								className,
								registrationKey,
								methodName,
								args,
								callback: () => value.apply(proxyReceiver, args),
							});

						wrappers.set(propertyKey, wrapped);
						return wrapped;
					},
				});
			},
		});
	}
}
