import { createModule, type ModuleDef } from "awilixify";
import { CatsModule } from "@/modules/cats/cats.module.js";

export type AppModuleDef = ModuleDef<{
	imports: [typeof CatsModule];
}>;

export const AppModule = createModule<AppModuleDef>({
	name: "AppModule",
	imports: [CatsModule],
});
