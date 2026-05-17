import {
	type Initializer,
	InitializerContext,
	resolveDecoratorState,
} from "awilixify";
import {
	rollUpHttpDecoratorState,
	HTTP_DECORATOR_STATE_TOKEN,
} from "awilixify/http";

import type { Deps } from "./http.module.js";
import { FASTIFY_ROUTE_CONFIG_TOKEN } from "./rate-limit.decorator.js";

type HttpToken = typeof HTTP_DECORATOR_STATE_TOKEN;

export class FastifyHttpInitializer implements Initializer<HttpToken> {
	public readonly token = HTTP_DECORATOR_STATE_TOKEN;
	private readonly registeredMethods = new Set<string>();

	constructor(private readonly deps: Deps) {}

	initialize(context: InitializerContext<HttpToken>) {
		const methodKey = `${context.target.name}:${String(context.methodName)}`;

		if (this.registeredMethods.has(methodKey)) return;

		this.registeredMethods.add(methodKey);

		const methodState = rollUpHttpDecoratorState(
			context.decoratorState.root,
			context.metadata,
		);

		const fastifyRouteConfigState = resolveDecoratorState(
			context.target,
			FASTIFY_ROUTE_CONFIG_TOKEN,
		);

		const config = fastifyRouteConfigState?.methods.get(context.methodName);

		for (const verb of methodState.verbs) {
			for (const path of methodState.paths) {
				this.deps.app.route({
					method: verb,
					url: path,
					handler: (req: unknown, res: unknown) => context.invoke(req, res),
					preHandler: methodState.beforeMiddleware,
					schema: methodState.schema,
					config: {
						rateLimit: config?.rateLimit,
					},
				});
			}
		}
	}
}
