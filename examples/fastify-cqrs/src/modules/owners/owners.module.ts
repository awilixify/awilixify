import {
	createModule,
	forwardRef,
	type ModuleDef,
	type ModuleRef,
	type Module,
} from "awilixify";
import { CatsModule, type CatsModuleDef } from "../cats/cats.module.js";
import { DbModule } from "@/integrations/db/db.module.js";
import { ScheduleModule } from "@/integrations/scheduler/scheduler.module.js";
import { TimeoutModule } from "@/integrations/timeout/timeout.module.js";

import { OwnersService } from "./owners.service.js";
import { Owners1Service } from "./owners1.service.js";
import { GetOwnersQueryHandler } from "./get-owners.q-handler.js";
import {
	OwnersController,
	OwnersHeartbeatCronTask,
} from "./owners.controller.js";

const dbScope = {
	readTables: ["cats"],
	writeTables: ["cats"],
} as const;
const OwnersSchedulerModule = ScheduleModule([OwnersHeartbeatCronTask]);

export type OwnersModuleDef = ModuleDef<{
	providers: {
		ownersService: OwnersService;
		owners1Service: Owners1Service;
	};
	exportKeys: ["ownersService", "owners1Service"];
	imports: [
		ModuleRef<CatsModuleDef>,
		ReturnType<typeof DbModule<typeof dbScope>>,
		typeof OwnersSchedulerModule,
		typeof TimeoutModule,
	];
	queryHandlers: [GetOwnersQueryHandler];
}>;

export type Deps = OwnersModuleDef["deps"];

export const OwnersModule: Module<OwnersModuleDef> =
	createModule<OwnersModuleDef>({
		name: "OwnersModule",

		imports: [
			forwardRef(() => CatsModule),
			DbModule(dbScope),
			OwnersSchedulerModule,
			TimeoutModule,
		],

		queryHandlers: [GetOwnersQueryHandler],
		controllers: [OwnersController],

		providerOptions: {
			// lifetime: "SCOPED",
			lifetime: "TRANSIENT",
		},

		providers: {
			owners1Service: {
				useClass: Owners1Service,
				// lifetime: "SCOPED",
			},
			ownersService: {
				useClass: OwnersService,
				// lifetime: "SCOPED",
			},
		},

		exports: ["ownersService", "owners1Service"],
	});
