import { type Deps } from "./scheduler.module.js";
import { getCronTaskId } from "./cron.decorator.js";

export class Scheduler {
	constructor(
		private readonly toadScheduler: Deps["toadScheduler"],
		private readonly allowedCronTasks: Deps["allowedCronTasks"],
	) {}

	getJobs() {
		return this.toadScheduler
			.getAllJobs()
			.filter((job) => job.id && this.allowedIds.includes(job.id));
	}

	private get allowedIds() {
		return this.allowedCronTasks.map(getCronTaskId);
	}
}
