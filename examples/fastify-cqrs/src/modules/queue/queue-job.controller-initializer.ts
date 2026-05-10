import type {
	ControllerInitializer,
	ControllerInitializerContext,
} from "awilixify";
import { Value } from "@sinclair/typebox/value";

import { ON_QUEUE_JOB_METADATA_TOKEN } from "./on-queue-job.decorator.js";
import { Deps } from "./queue.module.js";
import type { AnyQueueJobConstructor } from "./queue.types.js";
import { InvalidQueueJobPayloadError } from "./queue.service.js";

export class QueueJobControllerInitializer
	implements ControllerInitializer<AnyQueueJobConstructor>
{
	public readonly token = ON_QUEUE_JOB_METADATA_TOKEN;

	constructor(
		private readonly bullMqRegistry: Deps["bullMqRegistry"],
		private readonly processableJobs: Deps["processableJobs"],
	) {}

	initialize(
		context: ControllerInitializerContext<AnyQueueJobConstructor>,
	): void {
		const jobClass = context.metadata;

		if (!this.processableJobs.includes(jobClass)) {
			throw new Error(
				`Job "${jobClass.name}" is not processable in module "${context.moduleName}"`,
			);
		}

		const queueName = jobClass.queueName;

		this.bullMqRegistry.registerWorkerOrThrow(queueName, async (job) => {
			if (job.name !== queueName) {
				throw new Error(
					`Unexpected job name "${job.name}" for queue "${queueName}"`,
				);
			}

			if (
				jobClass.validationSchema &&
				!Value.Check(jobClass.validationSchema, job.data)
			) {
				throw new InvalidQueueJobPayloadError();
			}

			return context.invoke(job.data);
		});
	}
}
