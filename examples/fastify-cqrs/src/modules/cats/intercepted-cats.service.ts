import { Cachable } from "./cachable.decorator.js";

export class InterceptedCatsService {
	private readonly instanceId = Math.random().toString(36).substring(7);

	constructor(
		// private readonly ownersService: Deps["ownersService"],
		// private readonly owners1Service: Deps["owners1Service"],
		// private readonly dogsService: Deps["dogsService"],
	) {}

	getInstanceId(): string {
		return this.instanceId + " ???";
	}

	@Cachable("cats:list", { ttlMs: 10_000 })
	async getCatsInterceped(): Promise<{ catsServiceId: string }> {
		return {
			catsServiceId: this.getInstanceId(),
		};
	}
}
