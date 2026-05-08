import {
	createControllerInitializerDecorator,
	createControllerMetadataToken,
} from "awilix-modular";
import type { AnyEventConstructor } from "./event-emitter.types.js";

export const ON_EVENT_METADATA_TOKEN =
	createControllerMetadataToken<AnyEventConstructor>("on-event");

export function onEvent(event: AnyEventConstructor) {
	return createControllerInitializerDecorator(ON_EVENT_METADATA_TOKEN)(event);
}
