import { createModule, type ModuleDef } from "awilixify";

import { CatsModule } from "@/modules/cats/cats.module.js";
import { DebugCrowdingModule } from "@/modules/debug-crowding/debug-crowding.module.js";

export type AppModuleDef = ModuleDef<{
	imports: [
		typeof CatsModule,
		typeof DebugCrowdingModule,
	];
}>;

export const AppModule = createModule<AppModuleDef>({
	name: "AppModule",
	// TODO: registerControllers for handlers.
	imports: [CatsModule, DebugCrowdingModule],
	// imports: [CatsModule, { name: "Test", imports: [CatsModule] }],
});
