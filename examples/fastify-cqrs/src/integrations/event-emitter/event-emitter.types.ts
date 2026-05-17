import type { TSchema } from "@sinclair/typebox";
import { InvalidEventPayloadError } from "./event-emitter.service.js";

export abstract class Event<
	TPayload = unknown,
	TError extends Error = Error,
	TResult = void,
> {
	declare payload: TPayload;
	declare result: TResult;
	declare error: TError | InvalidEventPayloadError;

	constructor(payload: TPayload) {
		this.payload = payload;
	}

	static validationSchema?: TSchema;
}

export type EventConstructor<
	TPayload = unknown,
	TError extends Error = Error,
	TResult = void,
	TEvent extends Event<TPayload, TError, TResult> = Event<
		TPayload,
		TError,
		TResult
	>,
> = {
	new (payload: TPayload): TEvent;
	validationSchema?: TSchema;
};

export type AnyEventConstructor = EventConstructor<any, any>;

export type EventEmitterConfig<
	TEmittable extends Record<string, AnyEventConstructor> = Record<
		string,
		AnyEventConstructor
	>,
	TListeners extends
		readonly AnyEventConstructor[] = readonly AnyEventConstructor[],
> = {
	emittable: TEmittable;
	listeners: TListeners;
};

export function createEventScope<
	const TEmittable extends Record<string, AnyEventConstructor>,
	const TListeners extends readonly AnyEventConstructor[],
>(config: {
	emittable: TEmittable;
	listeners: TListeners;
}): EventEmitterConfig<TEmittable, TListeners> {
	return config;
}
