import {
	createInitializerDecorator,
	createControllerMetadataToken,
} from "awilixify";
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

export const CRON_METADATA_TOKEN =
	createControllerMetadataToken<CronTaskConstructor>("cron");

export function cron(task: CronTaskConstructor) {
	return createInitializerDecorator(CRON_METADATA_TOKEN)(task);
}
