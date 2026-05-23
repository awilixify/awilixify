import { QueryClient } from "@tanstack/react-query";
import {
	createModule,
	type InferComponentDeps,
	type ModuleDef,
} from "awilixify/react";
import { ProjectsModule } from "../projects/projects.module";
import { AboutPage } from "./AboutPage";
import { App } from "./App";
import { AppShell } from "./AppShell";

const components = {
	App,
	AppShell,
	AboutPage,
};

export type AppModuleDef = ModuleDef<{
	providers: {
		queryClient: QueryClient;
	};
	imports: [typeof ProjectsModule];
	components: typeof components;
}>;

export interface Deps extends InferComponentDeps<AppModuleDef> {}

export const AppModule = createModule<AppModuleDef>({
	name: "AppModule",
	imports: [ProjectsModule],
	providers: {
		queryClient: new QueryClient(),
	},
	components,
});
