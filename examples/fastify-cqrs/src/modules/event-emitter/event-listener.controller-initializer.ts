import type {
	ControllerInitializer,
	ControllerInitializerContext,
} from "awilix-modular";
import { ON_EVENT_METADATA_TOKEN } from "./on-event.decorator.js";
import type { Deps } from "./event-emitter.module.js";
import type { AnyEventConstructor } from "./event-emitter.types.js";

const EVENT_KEY_MAP = new WeakMap<AnyEventConstructor, symbol>();

// Use constructor identity -> symbol as the bus key.
// `constructor.name` is a mutable string (renames/minification can change it)
// and different classes may share the same name, causing collisions.
// Symbol keys are unique per constructor identity, so wiring is stable and collision-safe.
export function getEventKey(eventClass: AnyEventConstructor): symbol {
	const existing = EVENT_KEY_MAP.get(eventClass);
	if (existing) return existing;

	const key = Symbol(eventClass.name || "Event");
	EVENT_KEY_MAP.set(eventClass, key);

	return key;
}

export class EventListenerControllerInitializer
	implements ControllerInitializer<AnyEventConstructor>
{
	public readonly token = ON_EVENT_METADATA_TOKEN;

	constructor(
		private readonly emittery: Deps["emittery"],
		private readonly listenableEvents: Deps["listenableEvents"],
	) {}

	initialize(context: ControllerInitializerContext<AnyEventConstructor>): void {
		const eventClass = context.metadata;

		if (!this.listenableEvents.includes(eventClass)) {
			throw new Error(
				`Event "${eventClass.name}" is not listenable in module "${context.moduleName}"`,
			);
		}

		this.emittery.on(getEventKey(eventClass), ({ data }) => {
			context.invoke(data);
		});
	}
}
