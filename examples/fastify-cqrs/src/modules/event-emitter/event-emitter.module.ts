import Emittery from "emittery";
import { createStaticModule, type ModuleDef } from "awilix-modular";
import { EventListenerControllerInitializer } from "./event-listener.controller-initializer.js";
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
	controllerInitializers: {
		onEvent: typeof EventListenerControllerInitializer;
	};
	exportKeys: ["eventEmitter"];
	exportControllerInitializerKeys: ["onEvent"];
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
			controllerInitializers: {
				onEvent: EventListenerControllerInitializer,
			},
			controllerInitializerExports: ["onEvent"],
		},
		{ hashNameFrom: config },
	);
}
