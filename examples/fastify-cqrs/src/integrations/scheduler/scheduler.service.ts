import type { BeforeShutdown } from "awilixify";

import { getCronTaskId } from "./cron.decorator.js";
import type { Deps } from "./scheduler.module.js";

export class Scheduler implements BeforeShutdown {
	private readonly runningJobs = new Set<Promise<unknown>>();
	private stopping = false;

	constructor(
		private readonly toadScheduler: Deps["toadScheduler"],
		private readonly allowedCronTasks: Deps["allowedCronTasks"],
	) {}

	getJobs() {
		return this.toadScheduler
			.getAllJobs()
			.filter((job) => job.id && this.allowedIds.includes(job.id));
	}

	runJob(invoke: () => unknown): Promise<unknown> {
		if (this.stopping) return Promise.resolve();

		// Defer invocation so synchronous throws also become tracked rejections.
		const execution = Promise.resolve().then(invoke);
		const tracked = execution.finally(() => this.runningJobs.delete(tracked));
		this.runningJobs.add(tracked);

		return tracked;
	}

	async beforeShutdown() {
		this.stopping = true;
		for (const job of this.getJobs()) {
			if (job.id) this.toadScheduler.removeById(job.id);
		}

		await Promise.allSettled([...this.runningJobs]);
	}

	private get allowedIds() {
		return this.allowedCronTasks.map(getCronTaskId);
	}
}
