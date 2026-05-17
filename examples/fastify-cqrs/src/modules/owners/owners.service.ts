import { cancellable } from "@/modules/timeout/cancellable.decorator.js";

import type { Deps } from "./owners.module.js";

export class OwnersService {
	private readonly instanceId = Math.random().toString(36).substring(7);

	constructor(
		private readonly catsService: Deps["catsService"],
		private readonly owners1Service: Deps["owners1Service"],
	) {}

	getInstanceId(): string {
		return this.instanceId + " +++";
	}

	@cancellable()
	async getOwners() {
		await new Promise((resolve) => setTimeout(resolve, 4000));

		return {
			catsServiceId: this.catsService.getInstanceId(),
			ownersServiceId: this.getInstanceId(),
			owners1Service: this.owners1Service.getOwners1(),
		};
	}
}
