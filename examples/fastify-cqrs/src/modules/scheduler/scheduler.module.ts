import { createStaticModule, type ModuleDef } from "awilix-modular";

import { CronControllerInitializer } from "./cron.controller-initializer.js";
import { SchedulerService } from "./scheduler.service.js";

type SchedulerModuleDef = ModuleDef<{
	providers: {
		cronScheduler: SchedulerService;
	};
	exportKeys: "cronScheduler";
	controllerInitializers: [typeof CronControllerInitializer];
	exportControllerInitializers: typeof CronControllerInitializer;
}>;

export type Deps = SchedulerModuleDef["deps"];

export const SchedulerModule = createStaticModule<SchedulerModuleDef>({
	name: "SchedulerModule",
	providers: {
		cronScheduler: SchedulerService,
	},
	exports: {
		cronScheduler: SchedulerService,
	},
	controllerInitializers: [CronControllerInitializer],
	controllerInitializerExports: [CronControllerInitializer],
});
