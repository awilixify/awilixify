import {
	createInitializerDecorator,
	createControllerMetadataToken,
} from "awilixify";
import type { AnyEventConstructor } from "./event-emitter.types.js";

export const ON_EVENT_METADATA_TOKEN =
	createControllerMetadataToken<AnyEventConstructor>("on-event");

export function onEvent(event: AnyEventConstructor) {
	return createInitializerDecorator(ON_EVENT_METADATA_TOKEN)(event);
}
