import { createStaticModule, type ModuleDef } from "awilixify";
import { ToadScheduler } from "toad-scheduler";

import { type CronTaskConstructor } from "./cron.decorator.js";
import { Scheduler } from "./scheduler.service.js";
import { CronControllerInitializer } from "./cron.controller-initializer.js";

const SHARED_SCHEDULER = new ToadScheduler();

type SchedulerModuleDef = ModuleDef<{
	providers: {
		toadScheduler: ToadScheduler;
		allowedCronTasks: readonly CronTaskConstructor[];
		scheduler: Scheduler;
	};
	exportKeys: ["scheduler"];
	controllerInitializers: {
		cron: typeof CronControllerInitializer;
	};
	exportControllerInitializerKeys: ["cron"];
}>;

export type Deps = SchedulerModuleDef["deps"];

export function ScheduleModule(allowedCronTasks: readonly CronTaskConstructor[]) {
	return createStaticModule<SchedulerModuleDef>(
		{
			name: "SchedulerModule",
			providers: {
				toadScheduler: SHARED_SCHEDULER,
				allowedCronTasks,
				scheduler: Scheduler,
			},
			exports: ["scheduler"],
			controllerInitializers: {
				cron: CronControllerInitializer,
			},
			controllerInitializerExports: ["cron"],
		},
		{
			hashNameFrom: allowedCronTasks,
		},
	);
}
