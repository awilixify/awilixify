import { createDecoratorStateUpdater } from "awilixify";
import type { AnyEventConstructor } from "./event-emitter.types.js";

const updater = createDecoratorStateUpdater("Event Emitter Listeners", {
	method: (): AnyEventConstructor => undefined as never,
});

export const ON_EVENT_METADATA_TOKEN = updater.token;

export function onEvent(event: AnyEventConstructor) {
	return (target: any, context: ClassMethodDecoratorContext) => {
		updater.update(context, { method: () => event });

		return target;
	};
}
