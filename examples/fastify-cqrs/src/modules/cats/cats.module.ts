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
	exportKeys: "catsService";
	imports: [typeof OwnersModule, ReturnType<typeof DbModule<typeof dbScope>>];
	queryHandlers: [GetCatsQueryHandler];
	queryPreHandlers: {
		auth: CatsAuthMiddleware;
		logging: CatsLoggingMiddleware;
	};
}>;

export type Deps = CatsModuleDef["deps"];

export const CatsModule = createStaticModule<CatsModuleDef>({
	name: "CatsModule",

	imports: [OwnersModule, DbModule(dbScope)],

	queryPreHandlers: {
		auth: CatsAuthMiddleware,
		logging: { useClass: CatsLoggingMiddleware },
		// logging: CatsLoggingMiddleware,
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

	exports: {
		catsService: {
			allowCircular: true,
			// lifetime: "SINGLETON",
			// lifetime: "SCOPED",
			lifetime: "TRANSIENT",

			useClass: CatsService,
		},
	},

	// queryHandlers: [GetCatsQueryHandler],
	queryHandlers: [{ useClass: GetCatsQueryHandler }],
	controllers: [
		CatsController,
		CatsDecoratedController,
		{
			useClass: CatsScopedController,
			lifetime: "SCOPED",
		},
	],
});
