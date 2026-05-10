import { GET, schema, HttpStatus } from "awilixify";
import type { Request, Reply } from "@/types.js";

import type { Deps } from "./cats.module.js";
import { GetCatsSchema } from "./get-cats.dto.js";

export class CatsDecoratedController {
	private readonly instanceId = Math.random().toString(36).substring(7);

	constructor(private readonly getCatsService: Deps["getCatsService"]) {}

	@GET("/cats-decorated")
	@schema(GetCatsSchema)
	async getCats(
		req: Request<typeof GetCatsSchema>,
		res: Reply<typeof GetCatsSchema>,
	) {
		const result = await this.getCatsService.executor(req.query);

		res.status(HttpStatus.OK).send({
			controllerInstanceId: this.instanceId,
			result,
		});
	}
}
