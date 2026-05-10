import { GET, schema, HttpStatus } from "awilixify";
import type { Request, Reply } from "@/types.js";
import {
	createCronDefinition,
	cron,
} from "@/modules/scheduler/cron.decorator.js";

import type { Deps } from "./owners.module.js";
import { GetOwnersSchema } from "./get-owners.dto.js";

export const OwnersHeartbeatCron = createCronDefinition({
	id: "owners-heartbeat",
	seconds: 12,
});

export class OwnersController {
	constructor(
		private readonly queryMediator: Deps["queryMediator"],
		private readonly scheduler: Deps["scheduler"],
	) {}

	@GET("/owners")
	@schema(GetOwnersSchema)
	async getCats(
		req: Request<typeof GetOwnersSchema>,
		res: Reply<typeof GetOwnersSchema>,
	) {
		const result = await this.queryMediator.execute(
			"owners/get-owners",
			req.query,
			{
				executionContext: req.context,
			},
		);

		if (result.ok) {
			res.status(HttpStatus.OK).send({
				handlerId: result.value.handlerId,
			});
		}
	}

	@cron(OwnersHeartbeatCron)
	onHeartbeat() {
		console.log(
			"[OwnersController] cron tick",
			this.scheduler.getJobs().length,
			this.scheduler.getJobs()[0]?.id,
		);
	}
}
