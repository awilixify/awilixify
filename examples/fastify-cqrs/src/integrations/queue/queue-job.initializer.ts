import { Initializer } from "awilixify";
import type { InitializerContext } from "awilixify";
import { Value } from "@sinclair/typebox/value";

import { ON_QUEUE_JOB_METADATA_TOKEN } from "./on-queue-job.decorator.js";
import { Deps } from "./queue.module.js";
import { InvalidQueueJobPayloadError } from "./queue.service.js";

type QueueJobToken = typeof ON_QUEUE_JOB_METADATA_TOKEN;

export class QueueJobInitializer extends Initializer<QueueJobToken> {
	public readonly token = ON_QUEUE_JOB_METADATA_TOKEN;

	constructor(
		private readonly bullMqRegistry: Deps["bullMqRegistry"],
		private readonly processableJobs: Deps["processableJobs"],
	) {
		super();
	}

	initialize(context: InitializerContext<QueueJobToken>): void {
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
