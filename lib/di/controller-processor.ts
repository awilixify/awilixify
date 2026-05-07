import * as Awilix from "awilix";
import {
	HTTP_DECORATOR_STATE,
	type IHttpDecoratorState,
	type IRouteState,
	type MethodName,
	type RouteSchema,
} from "../decorators/http-state.js";
import {
	type ExpressFramework,
	type ExpressMethod,
	type FastifyFramework,
	HttpFramework,
} from "../http/framework.types.js";
import type { HttpVerb } from "../http/http-verbs.js";
import type { DiContextOptions } from "./di-context.js";
import * as ERRORS from "./errors.js";
import type { ConstructorController, Controller } from "./provider.types.js";
import {
	resolveFromRequestScope,
	runInRequestScopeContext,
} from "./request-scope-context.js";
import type { InternalModuleLike as M } from "./runtime-module.types.js";
import { isClassController } from "./type-guards.js";
import type { ControllerRuntimeEntry } from "./controller-initializer-processor.js";

type RouteRegistrationParams = {
	verb: HttpVerb;
	path: string;
	handler: any;
	preHandler: any[];
	schema: RouteSchema;
};

export class ControllerProcessor {
	private readonly registeredControllers = new WeakMap<
		ConstructorController,
		M
	>();
	private readonly frameworkType: HttpFramework;
	private readonly routeRegistrationFn: Record<
		HttpFramework,
		(params: RouteRegistrationParams) => void
	> = {
		[HttpFramework.FASTIFY]: this.registerFastifyRoute.bind(this),
		[HttpFramework.EXPRESS]: this.registerExpressRoute.bind(this),
		[HttpFramework.UNKNOWN]: () => {
			throw new ERRORS.UnsupportedFrameworkError();
		},
	};

	constructor(
		private readonly framework: unknown,
		private readonly providerOptions: Partial<Awilix.BuildResolverOptions<any>>,
		private readonly beforeRouteRegistered: DiContextOptions["beforeRouteRegistered"],
	) {
		this.frameworkType = this.detectFramework();
	}

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

				this.processDecoratedController(useClass, resolveController);
				runtimeEntries.push({
					controllerClass: useClass,
					resolve: resolveController,
				});

				continue;
			}

			// Same module instance imported multiple times - skip silently
			if (existingModule === m) {
				continue;
			}

			// Different module trying to register the same controller - throw error
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

	private processDecoratedController(
		target: ConstructorController,
		resolve: () => Controller,
	) {
		const state = this.getDecoratedState(target);

		if (!state) return;

		this.rollUpDecoratedState(state).forEach((routeState, methodName) => {
			this.registerRoute(methodName, routeState, resolve);
		});
	}

	private registerRoute(
		methodName: MethodName,
		routeState: IRouteState,
		resolve: () => any,
	) {
		routeState.verbs.forEach((verb) => {
			routeState.paths.forEach((path) => {
				const handler = async (request: any, reply: any) => {
					return runInRequestScopeContext(() =>
						resolve()[methodName](request, reply),
					);
				};

				const beforeMiddleware = this.beforeRouteRegistered?.({
					method: verb,
					path,
					schema: routeState.schema,
				});

				this.routeRegistrationFn[this.frameworkType]({
					verb,
					path,
					handler,
					preHandler: [
						...(beforeMiddleware ?? []),
						...routeState.beforeMiddleware,
					],
					schema: routeState.schema,
				});
			});
		});
	}

	private getDecoratedState(
		target: ConstructorController,
	): IHttpDecoratorState | undefined {
		const symbol = Object.getOwnPropertySymbols(target).find(
			(s) => s.toString() === "Symbol(Symbol.metadata)",
		);

		if (!symbol) return;

		return (target as any)[symbol][HTTP_DECORATOR_STATE];
	}

	private rollUpDecoratedState(
		state: IHttpDecoratorState,
	): IHttpDecoratorState["methods"] {
		const result: IHttpDecoratorState["methods"] = new Map();

		state.methods.forEach((method, key) => {
			result.set(key, {
				paths: this.concatPaths(state.root.paths, method.paths),
				beforeMiddleware: [
					...state.root.beforeMiddleware,
					...method.beforeMiddleware,
				],
				afterMiddleware: [
					...method.afterMiddleware,
					...state.root.afterMiddleware,
				],
				verbs: method.verbs,
				schema: method.schema,
			});
		});

		return result;
	}

	private registerFastifyRoute(params: RouteRegistrationParams) {
		(this.framework as FastifyFramework).route({
			method: params.verb,
			url: params.path,
			handler: params.handler,
			preHandler: params.preHandler,
			schema: params.schema,
		});
	}

	private registerExpressRoute(params: RouteRegistrationParams) {
		const method = params.verb.toLowerCase() as ExpressMethod;

		const handlers = [...params.preHandler];

		// Wrap handler to auto-send response if value is returned
		handlers.push(async (req: any, res: any, next: any) => {
			try {
				const result = await params.handler(req, res);
				if (result !== undefined && !res.headersSent) {
					res.send(result);
				}
			} catch (error) {
				next(error);
			}
		});

		(this.framework as ExpressFramework)[method](params.path, ...handlers);
	}

	private concatPaths(rootPaths: string[], methodPaths: string[]): string[] {
		if (rootPaths.length === 0) {
			return [...methodPaths];
		}

		const result: Array<string> = [];
		rootPaths.forEach((rootPath) => {
			methodPaths.forEach((methodPath) => {
				result.push(rootPath + methodPath);
			});
		});

		return result;
	}

	private detectFramework(): HttpFramework {
		if (this.isFastifyFramework()) {
			return HttpFramework.FASTIFY;
		}

		if (this.isExpressFramework()) {
			return HttpFramework.EXPRESS;
		}

		return HttpFramework.UNKNOWN;
	}

	private isFastifyFramework(): boolean {
		return Object.getOwnPropertySymbols(this.framework).some((key) =>
			key.toString().includes("fastify"),
		);
	}

	private isExpressFramework(): boolean {
		const framework: any = this.framework;

		return (
			typeof framework === "function" &&
			typeof framework.use === "function" &&
			typeof framework.get === "function" &&
			typeof framework.set === "function"
		);
	}
}
