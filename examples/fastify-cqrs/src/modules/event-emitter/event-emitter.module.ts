import Emittery from "emittery";
import { createStaticModule, type ModuleDef } from "awilixify";
import { EventListenerInitializer } from "./event-listener.initializer.js";
import { EventEmitter } from "./event-emitter.service.js";
import type {
	AnyEventConstructor,
	EventEmitterConfig,
} from "./event-emitter.types.js";

const emittery = new Emittery();

type EventEmitterProviders<
	TEmittable extends Record<string, AnyEventConstructor>,
> = {
	emittery: Emittery;
	emittableEvents: TEmittable;
	listenableEvents: readonly AnyEventConstructor[];
	eventEmitter: EventEmitter<TEmittable>;
} & Record<string, object | string | boolean | number>;

type EventEmitterModuleDef<
	TEmittable extends Record<string, AnyEventConstructor>,
> = ModuleDef<{
	providers: EventEmitterProviders<TEmittable>;
	initializers: {
		onEvent: typeof EventListenerInitializer;
	};
	exportKeys: ["eventEmitter"];
	exportInitializerKeys: ["onEvent"];
}>;

export type Deps = EventEmitterModuleDef<
	Record<string, AnyEventConstructor>
>["deps"];

export function EventEmitterModule<const TConfig extends EventEmitterConfig>(
	config: TConfig,
) {
	return createStaticModule<EventEmitterModuleDef<TConfig["emittable"]>>(
		{
			name: "EventEmitterModule",
			providers: {
				emittery,
				emittableEvents: config.emittable,
				listenableEvents: config.listeners,
				eventEmitter: EventEmitter,
			},
			exports: ["eventEmitter"],
			initializers: {
				onEvent: EventListenerInitializer,
			},
			initializerExports: ["onEvent"],
		},
		{ hashNameFrom: config },
	);
}
