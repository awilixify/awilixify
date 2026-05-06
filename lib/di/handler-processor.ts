import * as Awilix from "awilix";
import type { AnyContract } from "../mediator/contract.types.js";
import type { Handler } from "../mediator/handler.types.js";
import { Mediator } from "../mediator/mediator.js";
import type {
	Middleware,
	MiddlewareResolverMap,
} from "../mediator/middleware.types.js";
import * as ERRORS from "./errors.js";
import type { AnyMiddleware } from "./provider.types.js";
import {
	getOrCreateRequestScope,
	resolveFromRequestScope,
} from "./request-scope-context.js";
import type { InternalModuleLike as M } from "./runtime-module.types.js";
import { isClassHandler, isClassMiddleware } from "./type-guards.js";

export const HandlerType = {
	Query: "query",
	Command: "command",
} as const;

export type HandlerType = (typeof HandlerType)[keyof typeof HandlerType];

type ModuleWithScope = {
	module: M;
	scope: Awilix.AwilixContainer;
};

export class HandlerProcessor {
	private static readonly handlerConfig = {
		query: {
			prefix: "q",
			handlersKey: "queryHandlers",
			preHandlersKey: "queryPreHandlers",
			preHandlerExportsKey: "queryPreHandlerExports",
			mediatorKey: "queryMediator",
		},
		command: {
			prefix: "c",
			handlersKey: "commandHandlers",
			preHandlersKey: "commandPreHandlers",
			preHandlerExportsKey: "commandPreHandlerExports",
			mediatorKey: "commandMediator",
		},
	} as const;

	constructor(
		private readonly providerOptions: Partial<Awilix.BuildResolverOptions<any>>,
	) {}

	public processHandlers(
		m: M,
		scope: Awilix.AwilixContainer,
		importedModulesWithScope: ModuleWithScope[],
		handlerType: HandlerType,
	): void {
		const { prefix, handlersKey, mediatorKey } =
			HandlerProcessor.handlerConfig[handlerType];
		const middlewareResolvers = this.registerAndBuildMiddlewareResolvers(
			m,
			scope,
			importedModulesWithScope,
			handlerType,
		);
		const handlers = m[handlersKey];

		if (!handlers?.length) return;

		const mediator = new Mediator(middlewareResolvers, m.name);

		for (const h of handlers) {
			const { useClass: HandlerClass, ...handlerOptions } = isClassHandler(h)
				? h
				: { useClass: h };
			const handlerKey = (HandlerClass as { key?: unknown }).key;

			if (typeof handlerKey !== "string" || !handlerKey.length) {
				throw new ERRORS.HandlerMissingStaticKeyError(HandlerClass.name);
			}

			const options = this.extractResolverOptions(m, handlerOptions);
			const handlerSymbol = Symbol(`${prefix}-handler_${HandlerClass.name}`);

			scope.register({
				[handlerSymbol]: Awilix.asClass(HandlerClass, options),
			});

			mediator.register(handlerKey, (payload, context) => {
				const requestScope =
					options.lifetime === Awilix.Lifetime.SINGLETON
						? scope
						: getOrCreateRequestScope(scope);

				return requestScope
					.resolve<Handler<AnyContract>>(handlerSymbol)
					.executor(payload, context);
			});
		}

		scope.register({
			[mediatorKey]: Awilix.asValue(mediator),
		});
	}

	private registerAndBuildMiddlewareResolvers(
		m: M,
		scope: Awilix.AwilixContainer,
		importedModulesWithScope: ModuleWithScope[],
		handlerType: HandlerType,
	): MiddlewareResolverMap {
		const { preHandlersKey, preHandlerExportsKey } =
			HandlerProcessor.handlerConfig[handlerType];
		const resolverMap: MiddlewareResolverMap = new Map();
		const ownerByKey = new Map<string, string>();

		for (const {
			module: importedModule,
			scope: importedScope,
		} of importedModulesWithScope) {
			for (const [key, middleware] of Object.entries(
				importedModule[preHandlerExportsKey] ?? {},
			)) {
				if (resolverMap.has(key)) {
					throw new ERRORS.MiddlewareNameConflictError(
						m.name,
						key,
						ownerByKey.get(key) ?? importedModule.name,
						handlerType,
					);
				}

				const symbol = Symbol(
					`prehandler_export_${importedModule.name}_${key}`,
				);
				scope.register({
					[symbol]: this.resolveMiddlewareProvider({
						middleware,
						resolutionScope: importedScope,
						module: importedModule,
						wrapForExport: true,
					}),
				});

				resolverMap.set(key, () => resolveFromRequestScope(scope, symbol));
				ownerByKey.set(key, importedModule.name);
			}
		}

		for (const [key, middleware] of Object.entries(m[preHandlersKey] ?? {})) {
			if (resolverMap.has(key)) {
				throw new ERRORS.MiddlewareNameConflictError(
					m.name,
					key,
					ownerByKey.get(key) ?? m.name,
					handlerType,
				);
			}

			const symbol = Symbol(`prehandler_${m.name}_${key}`);
			scope.register({
				[symbol]: this.resolveMiddlewareProvider({
					middleware,
					resolutionScope: scope,
					module: m,
				}),
			});

			resolverMap.set(key, () => resolveFromRequestScope(scope, symbol));
			ownerByKey.set(key, m.name);
		}

		return resolverMap;
	}

	private resolveMiddlewareProvider({
		middleware,
		resolutionScope,
		module,
		wrapForExport,
	}: {
		middleware: AnyMiddleware;
		resolutionScope: Awilix.AwilixContainer;
		module: M;
		wrapForExport?: boolean;
	}): Awilix.Resolver<Middleware> {
		const { useClass: MiddlewareClass, ...middlewareOptions } =
			isClassMiddleware(middleware) ? middleware : { useClass: middleware };
		const resolverOptions = this.extractResolverOptions(
			module,
			middlewareOptions,
		);
		const resolver = Awilix.asClass(MiddlewareClass, resolverOptions);

		if (!wrapForExport) {
			return resolver;
		}

		return Awilix.asFunction(
			() =>
				resolver.resolve(
					resolverOptions.lifetime === Awilix.Lifetime.SINGLETON
						? resolutionScope
						: getOrCreateRequestScope(resolutionScope),
				),
			resolverOptions,
		);
	}

	private extractResolverOptions(
		module: M,
		options?: Partial<Awilix.BuildResolverOptions<any>>,
	): Awilix.BuildResolverOptions<any> {
		return {
			...this.providerOptions,
			...module.providerOptions,
			...options,
		};
	}
}
