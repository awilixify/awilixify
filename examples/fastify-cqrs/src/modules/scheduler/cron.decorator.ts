import {
	createControllerInitializerDecorator,
	createControllerMetadataToken,
} from "awilix-modular";
import { SimpleIntervalSchedule } from "toad-scheduler";
import { JobOptions } from "toad-scheduler/dist/lib/engines/simple-interval/SimpleIntervalJob.js";

export type CronMetadata = SimpleIntervalSchedule & JobOptions & { id: string };

export function createCronDefinition<const T extends CronMetadata>(
	metadata: T,
): T {
	return metadata;
}

export const CRON_METADATA_TOKEN =
	createControllerMetadataToken<CronMetadata>("cron");

export function cron(definition: CronMetadata) {
	return createControllerInitializerDecorator(CRON_METADATA_TOKEN)(definition);
}
