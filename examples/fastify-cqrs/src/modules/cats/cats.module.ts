import { createStaticModule, type ModuleDef } from "awilix-modular";

import { OwnersModule } from "@/modules/owners/owners.module.js";
import { DbModule } from "@/modules/db/db.module.js";
import { CatsController } from "./cats.controller.js";
import { CatsService } from "./cats.service.js";
import { CatsAuthMiddleware } from "./cats-auth.middleware.js";
import { CatsDecoratedController } from "./cats-decorated.controller.js";
import { CatsLoggingMiddleware } from "./cats-logging.middleware.js";
import { CatsScopedController } from "./cats-scoped.controller.js";
import { DogsService } from "./dogs.service.js";
import { GetCatsQueryHandler } from "./get-cats.q-handler.js";
import { GetCatsService } from "./get-cats.service.js";
import { InterceptedCatsService } from "./intercepted-cats.service.js";
import { CatsCacheInterceptor } from "./cats-cache.interceptor.js";
import { ScheduleModule } from "@/modules/scheduler/scheduler.module.js";
import { CatsHeartbeatCron } from "./cats.controller.js";
import { EventEmitterModule } from "@/modules/event-emitter/event-emitter.module.js";
import { CatsEventController } from "./cats.event.js";

const dbScope = {
	readTables: ["cats"],
	writeTables: ["cats"],
} as const;

export type CatsModuleDef = ModuleDef<{
	providers: {
		catsService: CatsService;
		dogsService: DogsService;
		getCatsService: GetCatsService;
		interceptedCatsService: InterceptedCatsService;
	};
	// exportKeys: ["catsService", 'catsService'];
	exportKeys: ["catsService"];
	imports: [
		typeof OwnersModule,
		ReturnType<typeof DbModule<typeof dbScope>>,
		ReturnType<typeof ScheduleModule>,
		ReturnType<
			typeof EventEmitterModule<(typeof CatsEventController)["eventScope"]>
		>,
	];
	queryHandlers: [GetCatsQueryHandler];
	queryPreHandlers: {
		auth: CatsAuthMiddleware;
		logging: CatsLoggingMiddleware;
	};
	interceptors: {
		cache: CatsCacheInterceptor;
	};
	exportInterceptorKeys: ["cache"];
}>;

export type Deps = CatsModuleDef["deps"];

export const CatsModule = createStaticModule<CatsModuleDef>({
	name: "CatsModule",

	imports: [
		OwnersModule,
		DbModule(dbScope),
		ScheduleModule([CatsHeartbeatCron]),
		EventEmitterModule(CatsEventController.eventScope),
	],

	queryPreHandlers: {
		auth: CatsAuthMiddleware,
		logging: { useClass: CatsLoggingMiddleware },
	},
	interceptors: {
		cache: CatsCacheInterceptor,
	},

	interceptorExports: ["cache"],
	// interceptorExports: [],

	providerOptions: {
		// lifetime: "SCOPED",
		// lifetime: "TRANSIENT",
	},

	providers: {
		interceptedCatsService: {
			useClass: InterceptedCatsService,
		},
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
		CatsEventController,
		CatsDecoratedController,
		{
			useClass: CatsScopedController,
			lifetime: "SCOPED",
		},
	],
});
