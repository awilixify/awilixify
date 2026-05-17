import type { TSchema } from "@sinclair/typebox";
import type { Options } from "amqplib";

export abstract class RabbitMessage<TPayload = unknown> {
	declare payload: TPayload;

	constructor(payload: TPayload) {
		this.payload = payload;
	}

	static routingKey: string;
	static validationSchema?: TSchema;
}

export type RabbitMessageConstructor<
	TPayload = unknown,
	TMessage extends RabbitMessage<TPayload> = RabbitMessage<TPayload>,
> = {
	new (payload: TPayload): TMessage;
	routingKey: string;
	validationSchema?: TSchema;
};

export type AnyRabbitMessageConstructor = RabbitMessageConstructor<any>;

export type RabbitConsumableBinding = {
	// Message class defines routing + schema. Consumer-side queue topology lives here.
	message: AnyRabbitMessageConstructor;
	// RabbitMQ consumers read from queues, not exchanges directly.
	queueName: string;
};

export type RabbitMqModuleConfig<
	TConsumable extends
		readonly RabbitConsumableBinding[] = readonly RabbitConsumableBinding[],
> = {
	// Producers publish to an exchange. Queues are then bound to it by routing key.
	exchange: {
		name: string;
		type?: "direct" | "topic" | "fanout" | "headers";
		options?: Options.AssertExchange;
	};
	consumable: TConsumable;
};

export function createRabbitScope<
	const TConsumable extends readonly RabbitConsumableBinding[],
>(
	config: RabbitMqModuleConfig<TConsumable>,
): RabbitMqModuleConfig<TConsumable> {
	return config;
}
