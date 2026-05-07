import type {
	ControllerInitializer,
	ControllerInitializerContext,
} from "awilix-modular";
import { AsyncTask, SimpleIntervalJob } from "toad-scheduler";

import { CRON_METADATA_TOKEN, type CronMetadata } from "./cron.decorator.js";
import { Deps } from "./scheduler.module.js";

export class CronControllerInitializer
	implements ControllerInitializer<CronMetadata>
{
	public readonly token = CRON_METADATA_TOKEN;

	constructor(
		private readonly toadScheduler: Deps["toadScheduler"],
		private readonly allowedCronDefinitions: Deps["allowedCronDefinitions"],
	) {}

	initialize(context: ControllerInitializerContext<CronMetadata>): void {
		const { id, preventOverrun, ...settings } = context.metadata;

		if (!this.allowedCronDefinitions.includes(context.metadata)) {
			throw new Error(
				`Cron definition with id: "${id}" is not allowed for module "${context.moduleName}"`,
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
