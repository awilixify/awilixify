import { createModule, type ModuleDef } from "awilixify";

import { RabbitMqCoreModule } from "./rabbitmq-core.module.js";
import { RabbitMessageInitializer } from "./rabbit-message.initializer.js";
import type {
	RabbitConsumableBinding,
	RabbitMqModuleConfig,
} from "./rabbitmq.types.js";

type RabbitMqModuleProviders<
	TConsumable extends readonly RabbitConsumableBinding[],
> = {
	exchange: RabbitMqModuleConfig<TConsumable>["exchange"];
	consumableMessages: TConsumable;
} & Record<string, object | string | boolean | number>;

type RabbitMqModuleDef<
	TConsumable extends readonly RabbitConsumableBinding[],
> = ModuleDef<{
	providers: RabbitMqModuleProviders<TConsumable>;
	imports: [typeof RabbitMqCoreModule];
	initializers: {
		onRabbitMessage: typeof RabbitMessageInitializer;
	};
	exportInitializerKeys: ["onRabbitMessage"];
}>;

export type Deps = RabbitMqModuleDef<
	readonly RabbitConsumableBinding[]
>["deps"];

export function RabbitMqModule<const TConfig extends RabbitMqModuleConfig>(
	config: TConfig,
) {
	return createModule<RabbitMqModuleDef<TConfig["consumable"]>>(
		{
			name: "RabbitMqModule",
			imports: [RabbitMqCoreModule],
			providers: {
				exchange: config.exchange,
				consumableMessages: config.consumable,
			},
			initializers: {
				onRabbitMessage: RabbitMessageInitializer,
			},
			initializerExports: ["onRabbitMessage"],
		},
		{ hashNameFrom: config },
	);
}
