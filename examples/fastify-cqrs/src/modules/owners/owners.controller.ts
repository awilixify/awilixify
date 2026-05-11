import { GET, schema } from "awilixify/http";
import type { Request, Reply } from "@/types.js";
import { CronTask, cron } from "@/modules/scheduler/cron.decorator.js";

import type { Deps } from "./owners.module.js";
import { GetOwnersSchema } from "./get-owners.dto.js";

export class OwnersHeartbeatCronTask extends CronTask {
	static readonly definition = {
		seconds: 12,
	};
}

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
			res.status(200).send({
				handlerId: result.value.handlerId,
			});
		}
	}

	// @cron(OwnersHeartbeatCronTask)
	onHeartbeat() {
		console.log(
			"[OwnersController] cron tick",
			this.scheduler.getJobs().length,
			this.scheduler.getJobs()[0]?.id,
		);
	}
}
