import {
	createModule,
	type InferGlobalDependencies,
	type ModuleDef,
} from "awilixify";
import { ConfigService } from "./config.service.js";

type ConfigModuleDef = ModuleDef<{
	providers: {
		config: ConfigService;
	};
	exportKeys: ["config"];
}>;

export const ConfigModule = createModule<ConfigModuleDef>({
	name: "ConfigModule",
	providers: {
		config: {
			useClass: ConfigService,
			eager: true,
		},
	},
	exports: ["config"],
});

declare module "awilixify" {
	interface GlobalDependencies
		extends InferGlobalDependencies<ConfigModuleDef> {}
}
