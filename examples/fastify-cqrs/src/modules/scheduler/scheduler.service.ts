import { type Deps } from "./scheduler.module.js";

export class Scheduler {
	constructor(
		private readonly toadScheduler: Deps["toadScheduler"],
		private readonly allowedCronDefinitions: Deps["allowedCronDefinitions"],
	) {}

	getJobs() {
		return this.toadScheduler
			.getAllJobs()
			.filter((job) => job.id && this.allowedIds.includes(job.id));
	}

	private get allowedIds() {
		return this.allowedCronDefinitions.map((el) => el.id);
	}
}
