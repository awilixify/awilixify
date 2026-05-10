import type {
	Initializer,
	InitializerContext,
} from "awilixify";
import { AsyncTask, SimpleIntervalJob } from "toad-scheduler";

import {
	CRON_METADATA_TOKEN,
	type CronTaskConstructor,
	getCronTaskId,
} from "./cron.decorator.js";
import { Deps } from "./scheduler.module.js";

export class CronInitializer
	implements Initializer<CronTaskConstructor>
{
	public readonly token = CRON_METADATA_TOKEN;

	constructor(
		private readonly toadScheduler: Deps["toadScheduler"],
		private readonly allowedCronTasks: Deps["allowedCronTasks"],
	) {}

	initialize(context: InitializerContext<CronTaskConstructor>): void {
		const cronTask = context.metadata;
		const { preventOverrun, ...settings } = cronTask.definition;
		const id = getCronTaskId(cronTask);

		if (!this.allowedCronTasks.includes(cronTask)) {
			throw new Error(
				`Cron task "${cronTask.name}" with id "${id}" is not allowed for module "${context.moduleName}"`,
			);
		}

		if (this.toadScheduler.existsById(id)) {
			throw new Error(`Cron already exists: ${id}`);
		}

		const task = new AsyncTask(
			id,
			() => Promise.resolve(context.invoke()),
			(error: unknown) => {
				console.error(`[Scheduler] job failed: ${id}`, error);
			},
		);

		const job = new SimpleIntervalJob(settings, task, {
			id,
			preventOverrun,
		});

		this.toadScheduler.addSimpleIntervalJob(job);
	}
}
