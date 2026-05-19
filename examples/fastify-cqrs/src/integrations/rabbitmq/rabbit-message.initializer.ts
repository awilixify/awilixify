import { Initializer, type InitializerContext } from "awilixify";

import type { Deps } from "./rabbitmq.module.js";
import { ON_RABBIT_MESSAGE_METADATA_TOKEN } from "./on-rabbit-message.decorator.js";

type RabbitMessageToken = typeof ON_RABBIT_MESSAGE_METADATA_TOKEN;

export class RabbitMessageInitializer extends Initializer<RabbitMessageToken> {
	public readonly token = ON_RABBIT_MESSAGE_METADATA_TOKEN;

	constructor(
		private readonly rabbitMqRegistry: Deps["rabbitMqRegistry"],
		private readonly exchange: Deps["exchange"],
		private readonly consumableMessages: Deps["consumableMessages"],
	) {
		super();
	}

	initialize(context: InitializerContext<RabbitMessageToken>): void {
		const messageClass = context.metadata;

		const binding = this.consumableMessages.find(
			(entry) => entry.message === messageClass,
		);

		if (!binding) {
			throw new Error(
				`Rabbit message "${messageClass.name}" is not consumable in module "${context.moduleName}"`,
			);
		}

		this.rabbitMqRegistry.registerConsumerOrThrow(
			this.exchange,
			binding,
			(payload) => context.invoke(payload),
		);
	}
}
