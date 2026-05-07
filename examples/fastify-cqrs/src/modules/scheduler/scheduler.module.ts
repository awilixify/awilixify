import { createStaticModule, type ModuleDef } from "awilix-modular";
import { ToadScheduler } from "toad-scheduler";
import { type CronMetadata } from "./cron.decorator.js";
import { Scheduler } from "./scheduler.service.js";
import { CronControllerInitializer } from "./cron.controller-initializer.js";

const SHARED_SCHEDULER = new ToadScheduler();

type SchedulerModuleDef = ModuleDef<{
	providers: {
		toadScheduler: ToadScheduler;
		allowedCronDefinitions: readonly CronMetadata[];
		scheduler: Scheduler;
	};
	exportKeys: "scheduler";
	controllerInitializers: [typeof CronControllerInitializer];
	exportControllerInitializers: typeof CronControllerInitializer;
}>;

export type Deps = SchedulerModuleDef["deps"];

export function ScheduleModule(
	allowedCronDefinitions: readonly CronMetadata[],
) {
	return createStaticModule<SchedulerModuleDef>({
		// TODO: maybe auto generation on awilix-modular level??
		name: `SchedulerModule_${allowedCronDefinitions
			.map((definition) => definition.id)
			.join("_")}`,
		providers: {
			toadScheduler: SHARED_SCHEDULER,
			allowedCronDefinitions,
			scheduler: Scheduler,
		},
		exports: {
			scheduler: Scheduler,
		},
		controllerInitializers: [CronControllerInitializer],
		controllerInitializerExports: [CronControllerInitializer],
	});
}
