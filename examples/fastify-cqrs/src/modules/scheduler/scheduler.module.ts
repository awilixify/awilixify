import { createStaticModule, type ModuleDef } from "awilixify";
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
	exportKeys: ["scheduler"];
	controllerInitializers: {
		cron: typeof CronControllerInitializer;
	};
	exportControllerInitializerKeys: ["cron"];
}>;

export type Deps = SchedulerModuleDef["deps"];

export function ScheduleModule(
	allowedCronDefinitions: readonly CronMetadata[],
) {
	return createStaticModule<SchedulerModuleDef>(
		{
			name: "SchedulerModule",
			providers: {
				toadScheduler: SHARED_SCHEDULER,
				allowedCronDefinitions,
				scheduler: Scheduler,
			},
			exports: ["scheduler"],
			controllerInitializers: {
				cron: CronControllerInitializer,
			},
			controllerInitializerExports: ["cron"],
		},
		{
			hashNameFrom: allowedCronDefinitions,
		},
	);
}
