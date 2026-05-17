import { GET, schema } from "awilixify/http";
import type { Request } from "@/modules/http/types.js";
import { rateLimit } from "@/modules/http/route-config.decorator.js";
import { timeout } from "@/modules/timeout/timeout.decorator.js";

import type { Deps } from "./cats.module.js";
import { GetCatsSchema } from "./get-cats.dto.js";

export class CatsDecoratedController {
	private readonly instanceId = Math.random().toString(36).substring(7);

	constructor(private readonly queryMediator: Deps["queryMediator"]) {}

	@GET("/cats-decorated/:id")
	@rateLimit({
		max: 3,
		timeWindow: "1 minute",
	})
	@timeout(3000)
	@schema(GetCatsSchema)
	async getCats(req: Request<typeof GetCatsSchema>) {
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
			},
		);

		if (!result.ok) {
			return result;
		}

		return {
			controllerInstanceId: this.instanceId,
			result: result.value,
		};
	}
}
