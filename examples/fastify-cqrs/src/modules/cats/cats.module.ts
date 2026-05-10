import { createStaticModule, type ModuleDef } from "awilixify";

import { DbModule } from "@/modules/db/db.module.js";
import { ScheduleModule } from "@/modules/scheduler/scheduler.module.js";
import { EventEmitterModule } from "@/modules/event-emitter/event-emitter.module.js";
import { QueueModule } from "@/modules/queue/queue.module.js";
import { CacheModule } from "@/modules/cache/cache.module.js";

import { OwnersModule } from "@/modules/owners/owners.module.js";
import { CatsController } from "./cats.controller.js";
import { CatsService } from "./cats.service.js";
import { CatsAuthMiddleware } from "./cats-auth.middleware.js";
import { CatsDecoratedController } from "./cats-decorated.controller.js";
import { CatsLoggingMiddleware } from "./cats-logging.middleware.js";
import { CatsScopedController } from "./cats-scoped.controller.js";
import { DogsService } from "./dogs.service.js";
import { GetCatsQueryHandler } from "./get-cats.q-handler.js";
import { GetCatsService } from "./get-cats.service.js";
import {
	CatsHeartbeatCronTask,
	CatsCronListeners,
} from "./cats.cron-listeners.js";
import { CatsEventListeners } from "./cats.event-listeners.js";
import { CatsQueueListeners } from "./cats.queue-listeners.js";

const dbScope = {
	readTables: ["cats"],
	writeTables: ["cats"],
} as const;

export type CatsModuleDef = ModuleDef<{
	providers: {
		catsService: CatsService;
		dogsService: DogsService;
		getCatsService: GetCatsService;
	};
	// exportKeys: ["catsService", 'catsService'];
	exportKeys: ["catsService"];
	imports: [
		typeof OwnersModule,
		ReturnType<typeof DbModule<typeof dbScope>>,
		ReturnType<typeof ScheduleModule>,
		ReturnType<
			typeof EventEmitterModule<(typeof CatsEventListeners)["EventScope"]>
		>,
		ReturnType<typeof QueueModule<(typeof CatsQueueListeners)["QueueScope"]>>,
		ReturnType<typeof CacheModule>,
	];
	queryHandlers: [GetCatsQueryHandler];
	queryPreHandlers: {
		auth: CatsAuthMiddleware;
		logging: CatsLoggingMiddleware;
	};
}>;

export type Deps = CatsModuleDef["deps"];

export const CatsModule = createStaticModule<CatsModuleDef>({
	name: "CatsModule",

	imports: [
		OwnersModule,
		DbModule(dbScope),
		ScheduleModule([CatsHeartbeatCronTask]),
		EventEmitterModule(CatsEventListeners.EventScope),
		QueueModule(CatsQueueListeners.QueueScope),
		CacheModule("cats"),
	],

	queryPreHandlers: {
		auth: CatsAuthMiddleware,
		logging: { useClass: CatsLoggingMiddleware },
	},
	providerOptions: {
		// lifetime: "SCOPED",
		// lifetime: "TRANSIENT",
	},

	providers: {
		getCatsService: {
			useClass: GetCatsService,
		},
		dogsService: {
			useClass: DogsService,
			// lifetime: "TRANSIENT"ta
		},
		catsService: {
			useClass: CatsService,
			// lifetime: "SCOPED",
			//

			allowCircular: true,
		},
	},

	exports: ["catsService"],
	// exports: ['catsService', 'catsService'],

	// queryHandlers: [GetCatsQueryHandler],
	queryHandlers: [{ useClass: GetCatsQueryHandler }],
	controllers: [
		CatsController,
		CatsEventListeners,
		CatsQueueListeners,
		CatsCronListeners,
		CatsDecoratedController,
		{
			useClass: CatsScopedController,
			lifetime: "SCOPED",
		},
	],
});
