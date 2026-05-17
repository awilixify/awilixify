import amqp, {
	type AmqpConnectionManager,
	type Channel,
	type ChannelWrapper,
} from "amqp-connection-manager";
import type { ConsumeMessage } from "amqplib";
import { Value } from "@sinclair/typebox/value";

import type { RabbitConsumableBinding } from "./rabbitmq.types.js";

export class InvalidRabbitMessagePayloadError extends Error {
	constructor(message = "Invalid rabbit message payload") {
		super(message);
		this.name = "InvalidRabbitMessagePayloadError";
	}
}

export class RabbitMqRegistry {
	private readonly connection: AmqpConnectionManager;
	// A channel is the AMQP session used to declare broker topology and attach consumers.
	private readonly channel: ChannelWrapper;
	private readonly registeredQueues = new Set<string>();

	constructor() {
		const url = process.env.RABBITMQ_URL ?? "amqp://guest:guest@localhost:5672";

		this.connection = amqp.connect([url]);
		this.channel = this.connection.createChannel({
			name: "awilixify-rabbitmq-consumers",
		});
	}

	registerConsumerOrThrow(
		// The module owns one exchange. Each listener binding declares its own queue
		// and binds it to that module exchange with a routing key.
		exchange: {
			name: string;
			type?: "direct" | "topic" | "fanout" | "headers";
			options?: amqp.Options.AssertExchange;
		},
		binding: RabbitConsumableBinding,
		handler: (payload: unknown) => Promise<unknown> | unknown,
	): void {
		if (this.registeredQueues.has(binding.queueName)) {
			throw new Error(
				`RabbitMQ consumer for queue "${binding.queueName}" is already registered`,
			);
		}

		this.registeredQueues.add(binding.queueName);

		void this.channel.addSetup(async (channel: Channel) => {
			// The exchange is the broker entrypoint for the whole module's events.
			await channel.assertExchange(
				exchange.name,
				exchange.type ?? "topic",
				exchange.options,
			);
			// The queue is this consumer group's inbox.
			await channel.assertQueue(binding.queueName);
			// Binding connects the queue to the exchange for one routing key.
			await channel.bindQueue(
				binding.queueName,
				exchange.name,
				binding.message.routingKey,
			);
			await channel.consume(
				binding.queueName,
				async (message: ConsumeMessage | null) => {
					if (!message) {
						return;
					}

					try {
						const payload = this.parsePayload(message.content);

						if (
							binding.message.validationSchema &&
							!Value.Check(binding.message.validationSchema, payload)
						) {
							throw new InvalidRabbitMessagePayloadError();
						}

						await handler(payload);
						this.channel.ack(message);
					} catch (error) {
						this.channel.nack(message, false);
						throw error;
					}
				},
			);
		});
	}

	private parsePayload(content: Buffer): unknown {
		const raw = content.toString("utf8");

		return JSON.parse(raw);
	}
}
