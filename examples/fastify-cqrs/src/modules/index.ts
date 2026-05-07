import { createStaticModule, type ModuleDef } from "awilix-modular";

import { CatsModule } from "@/modules/cats/cats.module.js";
import { SchedulerModule } from "@/modules/scheduler/scheduler.module.js";

export type AppModuleDef = ModuleDef<{
	imports: [typeof SchedulerModule, typeof CatsModule];
}>;

export const AppModule = createStaticModule<AppModuleDef>({
	name: "AppModule",
	// TODO: registerControllers for handlers.
	imports: [SchedulerModule, CatsModule],
	// imports: [CatsModule, { name: "Test", imports: [CatsModule] }],
});
