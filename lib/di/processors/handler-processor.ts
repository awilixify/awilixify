import * as Awilix from "awilix";
import type { AnyContract } from "../../mediator/contract.types.js";
import type { Handler } from "../../mediator/handler.types.js";
import { Mediator } from "../../mediator/mediator.js";
import type { Middleware } from "../../mediator/middleware.types.js";
import type { RegisteredModuleScope } from "../contexts/container-context-base.js";
import * as ERRORS from "../errors.js";
import type { InternalModuleLike as M } from "../modules/runtime-module.types.js";
import { ProviderResolver } from "../providers/provider-resolver.js";
import { getOrCreateRequestScope } from "../request-scope-context.js";
import { hasUseClass } from "../type-guards.js";
import { KeyedFeatureRegistrar } from "./keyed-feature-registrar.js";

export const HandlerType = {
	Query: "query",
	Command: "command",
} as const;

export type HandlerType = (typeof HandlerType)[keyof typeof HandlerType];

export class HandlerProcessor {
	private readonly keyedFeatureRegistrar: KeyedFeatureRegistrar;

	private static readonly handlerConfig = {
		query: {
			handlersKey: "queryHandlers",
			preHandlersKey: "queryPreHandlers",
			mediatorKey: "queryMediator",
		},
		command: {
			handlersKey: "commandHandlers",
			preHandlersKey: "commandPreHandlers",
			mediatorKey: "commandMediator",
		},
	} as const;

	constructor(
		private readonly providerOptions: Partial<Awilix.BuildResolverOptions<any>>,
	) {
		this.keyedFeatureRegistrar = new KeyedFeatureRegistrar(providerOptions);
	}

	public processHandlers(
		m: M,
		scope: Awilix.AwilixContainer,
		importedModulesWithScope: RegisteredModuleScope[],
		handlerType: HandlerType,
	): void {
		const { handlersKey, mediatorKey, preHandlersKey } =
			HandlerProcessor.handlerConfig[handlerType];
		const middlewareResolvers = this.keyedFeatureRegistrar.register<Middleware>(
			{
				featureKind: preHandlersKey,
				module: m,
				scope,
				importedModulesWithScope,
			},
		);

		const handlers = m[handlersKey];

		if (!handlers?.length) return;

		const mediator = new Mediator(middlewareResolvers, m.name);

		for (const h of handlers) {
			const { useClass: HandlerClass, ...handlerOptions } = hasUseClass(h)
				? h
				: { useClass: h };
			const handlerKey = (HandlerClass as { key?: unknown }).key;

			if (typeof handlerKey !== "string" || !handlerKey.length) {
				throw new ERRORS.HandlerMissingStaticKeyError(HandlerClass.name);
			}

			const options = ProviderResolver.mergeResolverOptions(
				m,
				this.providerOptions,
				handlerOptions,
			);
			const handlerSymbol = Symbol(`${handlerKey}_${HandlerClass.name}`);

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
}
