import { BaseError } from "@/common/base.error.js";
import { Value } from "@sinclair/typebox/value";
import { Job, type JobsOptions } from "bullmq";
import { Result } from "awilixify";
import { Deps } from "./queue.module.js";

import type { AnyQueueJobConstructor, QueueJob } from "./queue.types.js";

export class InvalidQueueJobPayloadError extends BaseError {
	static readonly CODE = "validation.invalid_queue_job_payload";
	readonly code = InvalidQueueJobPayloadError.CODE;

	constructor(message = "Invalid queue job payload") {
		super(message);
		this.name = "InvalidQueueJobPayloadError";
	}
}

type QueueErrorFromInstance<TJob extends QueueJob<any, any, any>> =
	TJob["error"] extends Error ? TJob["error"] : Error;

export class QueueService<
	TEnqueueable extends Record<string, AnyQueueJobConstructor>,
> {
	public readonly jobs: TEnqueueable;
	private readonly enqueueableConstructors: readonly AnyQueueJobConstructor[];

	constructor(
		private readonly bullMqRegistry: Deps["bullMqRegistry"],
		private readonly enqueueableJobs: TEnqueueable,
	) {
		this.jobs = this.enqueueableJobs;
		this.enqueueableConstructors = Object.values(this.enqueueableJobs);
	}

	public enqueue<TJob extends TEnqueueable[keyof TEnqueueable]>(
		job: InstanceType<TJob>,
		options?: JobsOptions,
	): Promise<Job<InstanceType<TJob>["payload"], unknown, string>> {
		const jobClass = job.constructor as TJob;

		if (!this.enqueueableConstructors.includes(jobClass)) {
			throw new Error(
				`Job "${jobClass.name}" is not enqueueable in this module scope`,
			);
		}

		if (
			jobClass.validationSchema &&
			!Value.Check(jobClass.validationSchema, job.payload)
		) {
			throw new InvalidQueueJobPayloadError();
		}

		return this.bullMqRegistry
			.getQueue(jobClass.queueName)
			.add(jobClass.queueName, job.payload, {
				...jobClass.defaultJobOptions,
				...options,
			});
	}

	public async enqueueWithResult<
		TJobInstance extends InstanceType<TEnqueueable[keyof TEnqueueable]>,
	>(
		job: TJobInstance,
		options?: JobsOptions,
	): Promise<
		Result<
			Job<TJobInstance["payload"], unknown, string>,
			QueueErrorFromInstance<TJobInstance>
		>
	> {
		try {
			const queued = await this.enqueue(job, options);
			return Result.ok(queued);
		} catch (error) {
			return Result.error(error as QueueErrorFromInstance<TJobInstance>);
		}
	}
}
