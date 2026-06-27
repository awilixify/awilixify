import { createDecoratorStateUpdater } from "awilixify";
import { SimpleIntervalSchedule } from "toad-scheduler";
import { JobOptions } from "toad-scheduler/dist/lib/engines/simple-interval/SimpleIntervalJob.js";

export type CronDefinition = SimpleIntervalSchedule & JobOptions;

export abstract class CronTask {
	static definition: CronDefinition;
}

export type CronTaskConstructor = {
	new (...args: never[]): CronTask;
	definition: CronDefinition;
};

export function getCronTaskId(task: CronTaskConstructor): string {
	return task.name;
}

const updater = createDecoratorStateUpdater("Cron Jobs", {
	method: (): CronTaskConstructor => undefined as never,
});

export const CRON_METADATA_TOKEN = updater.token;

export function cron(task: CronTaskConstructor) {
	return (target: any, context: ClassMethodDecoratorContext) => {
		updater.update(context, { method: () => task });

		return target;
	};
}
