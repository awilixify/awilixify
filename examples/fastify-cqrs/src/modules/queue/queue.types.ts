import type { JobsOptions } from "bullmq";
import type { TSchema } from "@sinclair/typebox";
import { InvalidQueueJobPayloadError } from "./queue.service.js";

export abstract class QueueJob<
	TPayload = unknown,
	TError extends Error = Error,
	TResult = unknown,
> {
	declare payload: TPayload;
	declare result: TResult;
	declare error: TError | InvalidQueueJobPayloadError;

	constructor(payload: TPayload) {
		this.payload = payload;
	}

	static queueName: string;
	static defaultJobOptions?: JobsOptions;
	static validationSchema?: TSchema;
}

export type QueueJobConstructor<
	TPayload = unknown,
	TError extends Error = Error,
	TResult = unknown,
	TJob extends QueueJob<TPayload, TError, TResult> = QueueJob<
		TPayload,
		TError,
		TResult
	>,
> = {
	new (payload: TPayload): TJob;
	queueName: string;
	defaultJobOptions?: JobsOptions;
	validationSchema?: TSchema;
};

export type AnyQueueJobConstructor = QueueJobConstructor<any, any, any>;

export type QueueModuleConfig<
	TEnqueueable extends Record<string, AnyQueueJobConstructor> = Record<
		string,
		AnyQueueJobConstructor
	>,
	TProcessable extends
		readonly AnyQueueJobConstructor[] = readonly AnyQueueJobConstructor[],
> = {
	enqueueable: TEnqueueable;
	processable: TProcessable;
};

export function createQueueScope<
	const TEnqueueable extends Record<string, AnyQueueJobConstructor>,
	const TProcessable extends readonly AnyQueueJobConstructor[],
>(config: {
	enqueueable: TEnqueueable;
	processable: TProcessable;
}): QueueModuleConfig<TEnqueueable, TProcessable> {
	return config;
}
