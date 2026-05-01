import {
	createStaticModule,
	forwardRef,
	type ModuleDef,
	type ModuleRef,
	type StaticModule,
} from "awilix-modular";
import { CatsModule, type CatsModuleDef } from "../cats/cats.module.js";
import { DbModule } from "@/modules/db/db.module.js";

import { OwnersService } from "./owners.service.js";
import { Owners1Service } from "./owners1.service.js";
import { GetOwnersQueryHandler } from "./get-owners.q-handler.js";
import { OwnersController } from "./owners.controller.js";

const dbScope = {
	readTables: ["cats"],
	writeTables: ["cats"],
} as const;

export type OwnersModuleDef = ModuleDef<{
	providers: {
		ownersService: OwnersService;
		owners1Service: Owners1Service;
	};
	exportKeys: "ownersService" | "owners1Service";
	imports: [
		ModuleRef<CatsModuleDef>,
		ReturnType<typeof DbModule<typeof dbScope>>,
	];
	queryHandlers: [GetOwnersQueryHandler];
}>;

export type Deps = OwnersModuleDef["deps"];

export const OwnersModule: StaticModule<OwnersModuleDef> =
	createStaticModule<OwnersModuleDef>({
		name: "OwnersModule",

		imports: [forwardRef(() => CatsModule), DbModule(dbScope)],

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

		exports: {
			owners1Service: {
				useClass: Owners1Service,
				// lifetime: "SCOPED",
				lifetime: "SCOPED",
			},
			ownersService: {
				useClass: OwnersService,
				// lifetime: "TRANSIENT",
				lifetime: "SCOPED",

				// allowCircular: true,
			},
		},
	});
