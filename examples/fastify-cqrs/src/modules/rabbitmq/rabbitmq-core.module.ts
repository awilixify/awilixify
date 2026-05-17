import { createModule, type ModuleDef } from "awilixify";

import { RabbitMqRegistry } from "./rabbitmq-registry.service.js";

type RabbitMqCoreModuleDef = ModuleDef<{
	providers: {
		rabbitMqRegistry: RabbitMqRegistry;
	};
	exportKeys: ["rabbitMqRegistry"];
}>;

export const RabbitMqCoreModule = createModule<RabbitMqCoreModuleDef>({
	name: "RabbitMqCoreModule",
	providers: {
		rabbitMqRegistry: RabbitMqRegistry,
	},
	exports: ["rabbitMqRegistry"],
});
