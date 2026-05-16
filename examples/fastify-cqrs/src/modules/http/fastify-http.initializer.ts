import { type Initializer, InitializerContext } from "awilixify";
import {
	rollUpHttpDecoratorState,
	HTTP_DECORATOR_STATE_TOKEN,
} from "awilixify/http";

import type { Deps } from "./http.module.js";

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

		for (const verb of methodState.verbs) {
			for (const path of methodState.paths) {
				this.deps.app.route({
					method: verb,
					url: path,
					handler: (req: unknown, res: unknown) => context.invoke(req, res),
					preHandler: methodState.beforeMiddleware,
					schema: methodState.schema,
				});
			}
		}
	}
}
