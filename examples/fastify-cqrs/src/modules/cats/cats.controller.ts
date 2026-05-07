import { type Controller } from "awilix-modular";

import { mapApplicationErrorToHttpError } from "@/common/error-to-http-error.mapper.js";
import {
	createCronDefinition,
	cron,
} from "@/modules/scheduler/cron.decorator.js";

import type { Deps } from "./cats.module.js";
import { GetCatsSchema } from "./get-cats.dto.js";

export const CatsHeartbeatCron = createCronDefinition({
	id: "heartbeat",
	seconds: 10,
});

export class CatsController implements Controller {
	private readonly instanceId = Math.random().toString(36).substring(7);

	constructor(
		private readonly app: Deps["app"],
		private readonly queryMediator: Deps["queryMediator"],
		private scheduler: Deps["scheduler"],
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

				if (result.ok) {
					// Success case - return data
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

	@cron(CatsHeartbeatCron)
	onHeartbeat() {
		console.log("[CatsController] cron tick", this.scheduler.getJobs()[0]?.id);
	}
}
