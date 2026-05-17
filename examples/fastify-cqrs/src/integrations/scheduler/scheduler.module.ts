import { createModule, type ModuleDef } from "awilixify";
import { ToadScheduler } from "toad-scheduler";

import { type CronTaskConstructor } from "./cron.decorator.js";
import { Scheduler } from "./scheduler.service.js";
import { CronInitializer } from "./cron.initializer.js";

const SHARED_SCHEDULER = new ToadScheduler();

type SchedulerModuleDef = ModuleDef<{
	providers: {
		toadScheduler: ToadScheduler;
		allowedCronTasks: readonly CronTaskConstructor[];
		scheduler: Scheduler;
	};
	exportKeys: ["scheduler"];
	initializers: {
		cron: typeof CronInitializer;
	};
	exportInitializerKeys: ["cron"];
}>;

export type Deps = SchedulerModuleDef["deps"];

export function ScheduleModule(
	allowedCronTasks: readonly CronTaskConstructor[],
) {
	return createModule<SchedulerModuleDef>(
		{
			name: "SchedulerModule",
			providers: {
				toadScheduler: SHARED_SCHEDULER,
				allowedCronTasks,
				scheduler: Scheduler,
			},
			exports: ["scheduler"],
			initializers: {
				cron: CronInitializer,
			},
			initializerExports: ["cron"],
		},
		{
			hashNameFrom: allowedCronTasks,
		},
	);
}
