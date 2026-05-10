import {
	createStaticModule,
	forwardRef,
	type ModuleDef,
	type ModuleRef,
	type StaticModule,
} from "awilixify";
import { CatsModule, type CatsModuleDef } from "../cats/cats.module.js";
import { DbModule } from "@/modules/db/db.module.js";
import { ScheduleModule } from "@/modules/scheduler/scheduler.module.js";

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
	];
	queryHandlers: [GetOwnersQueryHandler];
}>;

export type Deps = OwnersModuleDef["deps"];

export const OwnersModule: StaticModule<OwnersModuleDef> =
	createStaticModule<OwnersModuleDef>({
		name: "OwnersModule",

		imports: [
			forwardRef(() => CatsModule),
			DbModule(dbScope),
			OwnersSchedulerModule,
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
