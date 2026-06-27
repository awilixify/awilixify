import { createDecoratorStateUpdater } from "awilixify";

import type { AnyRabbitMessageConstructor } from "./rabbitmq.types.js";

const updater = createDecoratorStateUpdater("RabbitMQ listeners", {
	method: (): AnyRabbitMessageConstructor => undefined as never,
});

export const ON_RABBIT_MESSAGE_METADATA_TOKEN = updater.token;

export function onRabbitMessage(message: AnyRabbitMessageConstructor) {
	return (target: any, context: ClassMethodDecoratorContext) => {
		updater.update(context, { method: () => message });

		return target;
	};
}
