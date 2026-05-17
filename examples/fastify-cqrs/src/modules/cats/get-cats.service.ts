import type { Deps } from "./cats.module.js";
import type {
	GetCatsQuery as Payload,
	GetCatsResult as Response,
} from "./get-cats.dto.js";

export class GetCatsService {
	private readonly instanceId = Math.random().toString(36).substring(7);

	constructor(
		private readonly catsService: Deps["catsService"],
		private readonly dogsService: Deps["dogsService"],
	) {}

	async executor(payload: Payload): Promise<Response> {
		await new Promise((resolve) => setTimeout(resolve, 4000));

		return {
			handlerId: this.instanceId,
			dogsServiceId: this.dogsService.getInstanceId(),
			catsServiceId: this.catsService.getInstanceId(),
			catsService: await this.catsService.getCats("1"),
			dogsService: this.dogsService.getDogs(),
		};
	}
}
