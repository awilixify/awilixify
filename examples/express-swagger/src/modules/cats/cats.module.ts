import { createStaticModule, type ModuleDef } from "awilixify";

import { CatsController } from "./cats.controller.js";
import { CatsService } from "./cats.service.js";
import { CatsDecoratedController } from "./cats-decorated.controller.js";
import { GetCatsService } from "./get-cats.service.js";

export type CatsModuleDef = ModuleDef<{
	providers: {
		catsService: CatsService;
		getCatsService: GetCatsService;
	};
	exportKeys: ["catsService"];
}>;

export type Deps = CatsModuleDef["deps"];

export const CatsModule = createStaticModule<CatsModuleDef>({
	name: "CatsModule",

	providers: {
		getCatsService: {
			useClass: GetCatsService,
		},
		catsService: {
			useClass: CatsService,
		},
	},

	exports: {
		catsService: {
			useClass: CatsService,
		},
	},

	controllers: [CatsController, CatsDecoratedController],
});
