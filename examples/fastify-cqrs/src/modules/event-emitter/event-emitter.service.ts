import { BaseError } from "@/common/base.error.js";
import { getEventKey } from "./event-listener.controller-initializer.js";
import type { AnyEventConstructor, Event } from "./event-emitter.types.js";
import { Deps } from "./event-emitter.module.js";
import { Value } from "@sinclair/typebox/value";
import { Result } from "awilixify";

export class InvalidEventPayloadError extends BaseError {
	static readonly CODE = "validation.invalid_event_payload";
	readonly code = InvalidEventPayloadError.CODE;

	constructor(message = "Invalid event payload error") {
		super(message);
		this.name = "InvalidEventPayloadError";
	}
}

type EventErrorFromInstance<TEvent extends Event<any, any, any>> =
	TEvent["error"] extends Error ? TEvent["error"] : Error;

function unwrapEmitteryError(error: unknown): Error {
	if (
		error instanceof AggregateError &&
		Array.isArray(error.errors) &&
		error.errors.length > 0
	) {
		const first = error.errors[0];

		return first instanceof Error ? first : error;
	}

	return error instanceof Error ? error : new Error("Event emit failed");
}

export class EventEmitter<
	TEmittable extends Record<string, AnyEventConstructor>,
> {
	public readonly events: TEmittable;
	private readonly emittableEventConstructors: readonly AnyEventConstructor[];

	constructor(
		private readonly emittery: Deps["emittery"],
		private readonly emittableEvents: TEmittable,
	) {
		this.events = this.emittableEvents;
		this.emittableEventConstructors = Object.values(emittableEvents);
	}

	public emit<TEvent extends TEmittable[keyof TEmittable]>(
		event: InstanceType<TEvent>,
	): Promise<void> {
		const eventConstructor = event.constructor as TEvent;

		if (!this.emittableEventConstructors.includes(eventConstructor)) {
			throw new Error(
				`Event "${eventConstructor.name}" is not emittable in this module scope`,
			);
		}

		if (
			eventConstructor.validationSchema &&
			!Value.Check(eventConstructor.validationSchema, event.payload)
		) {
			throw new InvalidEventPayloadError();
		}

		return this.emittery.emit(getEventKey(eventConstructor), event.payload);
	}

	public async emitWithResult<
		TEventInstance extends InstanceType<TEmittable[keyof TEmittable]>,
	>(
		event: TEventInstance,
	): Promise<Result<void, EventErrorFromInstance<TEventInstance>>> {
		try {
			await this.emit(event);

			return Result.ok(undefined);
		} catch (error) {
			return Result.error(
				unwrapEmitteryError(error) as EventErrorFromInstance<TEventInstance>,
			);
		}
	}
}
