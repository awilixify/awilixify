import { onEvent } from "@/modules/event-emitter/on-event.decorator.js";
import {
	createEventScope,
	Event,
} from "@/modules/event-emitter/event-emitter.types.js";
import { BaseError } from "@/common/base.error.js";
import { type Static, Type } from "@sinclair/typebox";

export class CatsViewedEventError extends BaseError {
	static readonly CODE = "cats.event.viewed_emit_failed";
	readonly code = CatsViewedEventError.CODE;

	constructor(message = "CatsViewedEvent emit failed") {
		super(message);
		this.name = "CatsViewedEventError";
	}
}

export class CatsViewedEvent extends Event<
	Static<(typeof CatsViewedEvent)["validationSchema"]>,
	CatsViewedEventError
> {
	static readonly validationSchema = Type.Object({
		catId: Type.String(),
		at: Type.Number(),
	});
}

export class CatsHeartbeatEvent extends Event<
	Static<(typeof CatsHeartbeatEvent)["validationSchema"]>
> {
	static readonly validationSchema = Type.Object({
		at: Type.Number(),
		source: Type.String(),
	});
}

// Structural extension point: module can listen to imported module emittable events.
const importedEmittableEvents = [] as const;

export class CatsEventController {
	static eventScope = createEventScope({
		emittable: {
			CatsViewedEvent,
			CatsHeartbeatEvent,
		},
		listeners: [
			CatsHeartbeatEvent,
			CatsViewedEvent,
			...importedEmittableEvents,
		],
	});

	@onEvent(CatsHeartbeatEvent)
	onHeartbeatEvent(payload: CatsHeartbeatEvent["payload"]) {
		console.log("[CatsController] heartbeat event", payload);
	}

	@onEvent(CatsViewedEvent)
	onViewedEvent(payload: CatsViewedEvent["payload"]) {
		throw new CatsViewedEventError(
			`Cats viewed listener failed for catId=${payload.catId}`,
		);
	}
}
