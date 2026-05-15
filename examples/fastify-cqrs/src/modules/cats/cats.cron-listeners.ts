import { CronTask, cron } from "@/modules/scheduler/cron.decorator.js";
import type { Deps } from "./cats.module.js";

export class CatsHeartbeatCronTask extends CronTask {
	// TODO: what if it's taken from config class
	static readonly definition = {
		seconds: 10,
	} as const;
}

export class CatsCronListeners {
	constructor(
		private readonly eventEmitter: Deps["eventEmitter"],
		private readonly scheduler: Deps["scheduler"],
		private readonly config: Deps["config"],
	) {}

	// @cron(CatsHeartbeatCronTask)
	onHeartbeat() {
		void this.eventEmitter.emit(
			new this.eventEmitter.events.CatsHeartbeatEvent({
				at: Date.now(),
				source: "cron",
			}),
		);

		console.log(
			"[CatsCronListeners] cron tick",
			this.scheduler.getJobs()[0]?.id,
		);
	}
}
