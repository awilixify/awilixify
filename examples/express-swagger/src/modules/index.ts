import {
	createStaticModule,
	type ModuleDef,
} from "awilixify";
import { CatsModule } from "@/modules/cats/cats.module.js";

export type AppModuleDef = ModuleDef<{
	imports: [typeof CatsModule];
}>;

export const AppModule = createStaticModule<AppModuleDef>({
	name: "AppModule",
	imports: [CatsModule],
});
