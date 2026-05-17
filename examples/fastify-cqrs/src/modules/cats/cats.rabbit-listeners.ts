import { Type, type Static } from "@sinclair/typebox";

import { onRabbitMessage } from "@/modules/rabbitmq/on-rabbit-message.decorator.js";
import {
	RabbitMessage,
	createRabbitScope,
} from "@/modules/rabbitmq/rabbitmq.types.js";

export class CatsViewedRabbitMessage extends RabbitMessage<
	Static<(typeof CatsViewedRabbitMessage)["validationSchema"]>
> {
	static readonly routingKey = "cats.viewed";
	static readonly validationSchema = Type.Object({
		catId: Type.String(),
		at: Type.Number(),
	});
}

export class CatsRabbitListeners {
	static RabbitScope = createRabbitScope({
		// One module-level exchange for cat-related events.
		exchange: {
			name: "cats.events",
			type: "topic",
		},
		consumable: [
			{
				// This queue is this listener group's inbox for cats.viewed events.
				message: CatsViewedRabbitMessage,
				queueName: "cats.viewed.example",
			},
		],
	});

	@onRabbitMessage(CatsViewedRabbitMessage)
	onCatsViewed(payload: CatsViewedRabbitMessage["payload"]) {
		console.log("[CatsRabbitListeners] rabbit message processed", payload);
	}
}
