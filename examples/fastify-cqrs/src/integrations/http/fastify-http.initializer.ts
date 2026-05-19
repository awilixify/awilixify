import {
	Initializer,
	InitializerContext,
	resolveDecoratorState,
	isResultLike,
} from "awilixify";
import {
	httpException,
	rollUpHttpDecoratorState,
	HTTP_DECORATOR_STATE_TOKEN,
} from "awilixify/http";
import type { FastifyReply, FastifyRequest } from "fastify";

import type { Deps } from "./http.module.js";
import { FASTIFY_ROUTE_CONFIG_TOKEN } from "./route-config.decorator.js";
import { mapApplicationErrorToHttpError } from "@/common/error-to-http-error.mapper.js";
import { BaseError } from "@/common/base.error.js";

type HttpToken = typeof HTTP_DECORATOR_STATE_TOKEN;

export class FastifyHttpInitializer extends Initializer<HttpToken> {
	public readonly token = HTTP_DECORATOR_STATE_TOKEN;
	private readonly registeredMethods = new Set<string>();

	constructor(private readonly deps: Deps) {
		super();
	}

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
				const handler = async (req: FastifyRequest, res: FastifyReply) => {
					const result = await context.invoke(req, res);

					if (res.sent || result === undefined) {
						return;
					}

					if (isResultLike(result)) {
						if (result.ok) {
							return res.status(200).send(result.value);
						}

						const error = mapResultErrorToHttpError(result.error);

						return res.status(error.statusCode).send(error.getResponse());
					}

					return result;
				};

				this.deps.app.route({
					method: verb,
					url: path,
					handler,
					preHandler: methodState.beforeMiddleware,
					schema: methodState.schema,
					...(config?.rateLimit
						? {
								config: {
									rateLimit: config.rateLimit,
								},
							}
						: {}),
				});
			}
		}
	}
}

function mapResultErrorToHttpError(error: unknown) {
	try {
		return mapApplicationErrorToHttpError(error as BaseError);
	} catch {
		return httpException.internalServerError(
			"Unhandled application error",
			{
				code:
					error instanceof BaseError
						? error.code
						: "internal.unmapped_application_error",
			},
		);
	}
}
