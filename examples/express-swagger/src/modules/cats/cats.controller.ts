import { GET, schema } from "awilixify";
import type { Request, Response } from "@/types.js";
import type { Deps } from "./cats.module.js";
import { GetCatsSchema } from "./get-cats.dto.js";

export class CatsController {
	private readonly instanceId = Math.random().toString(36).substring(7);

	constructor(private readonly getCatsService: Deps["getCatsService"]) {}

	@GET("/cats")
	@schema(GetCatsSchema)
	async getCats(
		req: Request<typeof GetCatsSchema>,
		res: Response<typeof GetCatsSchema>,
	) {
		const result = await this.getCatsService.executor(req.query);

		return res.status(200).send({
			controllerInstanceId: this.instanceId,
			result,
		});
	}
}
