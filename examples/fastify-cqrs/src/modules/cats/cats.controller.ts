import { type Controller } from "awilixify";

import { mapApplicationErrorToHttpError } from "@/common/error-to-http-error.mapper.js";

import type { Deps } from "./cats.module.js";
import { GetCatsSchema } from "./get-cats.dto.js";

export class CatsController implements Controller {
	private readonly instanceId = Math.random().toString(36).substring(7);

	constructor(
		private readonly app: Deps["app"],
		private readonly queryMediator: Deps["queryMediator"],
		private readonly eventEmitter: Deps["eventEmitter"],
		private readonly queue: Deps["queue"],
	) {}

	registerRoutes() {
		this.app.route({
			method: "GET",
			url: "/cats/:id",
			schema: GetCatsSchema,
			// fully type safe thanks to TypeBoxTypeProvider
			handler: async (req, res) => {
				// error type should be merged with applied middlewares
				const result = await this.queryMediator.execute(
					"cats/get-cats",
					{
						...req.params,
						...req.query,
					},
					{
						executionContext: req.context,
						scenario: "auth-logging",
						includePreHandlerKeys: ["auth", "logging"],
						// scenario: "logging-tenant",
						// includePreHandlerKeys: ["logging", "tenant"],
						// scenario: "default",
					},
				);

				const emitted = await this.eventEmitter.emitWithResult(
					new this.eventEmitter.events.CatsViewedEvent({
						catId: String(req.params.id),
						at: Date.now(),
					}),
				);

				if (!emitted.ok) {
					const eventError = mapApplicationErrorToHttpError(emitted.error);

					return res
						.status(eventError.statusCode)
						.send(eventError.getResponse());
				}

				await this.queue.add(
					new this.queue.jobs.CatsViewedQueueJob({
						catId: String(req.params.id),
						at: Date.now(),
					}),
				);

				if (result.ok) {
					return res.status(200).send({
						controllerInstanceId: this.instanceId,
						result: result.value,
					});
				}

				const error = mapApplicationErrorToHttpError(result.error);

				return res.status(error.statusCode).send(error.getResponse());
			},
		});
	}
}
