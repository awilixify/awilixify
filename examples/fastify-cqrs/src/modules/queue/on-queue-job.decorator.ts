import {
	createControllerInitializerDecorator,
	createControllerMetadataToken,
} from "awilixify";
import type { AnyQueueJobConstructor } from "./queue.types.js";

export const ON_QUEUE_JOB_METADATA_TOKEN =
	createControllerMetadataToken<AnyQueueJobConstructor>("on-queue-job");

export function onQueueJob(job: AnyQueueJobConstructor) {
	return createControllerInitializerDecorator(ON_QUEUE_JOB_METADATA_TOKEN)(job);
}
