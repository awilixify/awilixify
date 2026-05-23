import {
	createModule,
	type InferComponentDeps,
	type InferProviderDeps,
	type ModuleDef,
} from "awilixify/react";

import { ProjectPage } from "./components/ProjectPage";
import { ProjectRow } from "./components/ProjectRow";
import { ProjectsPage } from "./components/ProjectsPage";
import { StatusBadge } from "./components/StatusBadge";
import { ProjectService } from "./project.service";
import { ProjectSummaryService } from "./project-summary.service";

export const components = {
	ProjectsPage,
	ProjectPage,
	ProjectRow,
	StatusBadge,
};

export type ProjectModuleDef = ModuleDef<{
	providers: {
		projectService: ProjectService;
		projectSummaryService: ProjectSummaryService;
	};
	components: typeof components;
	componentExportKeys: ["ProjectsPage", "ProjectPage"];
}>;

export interface Deps extends InferComponentDeps<ProjectModuleDef> {}
export interface ProviderDeps extends InferProviderDeps<ProjectModuleDef> {}

export const ProjectsModule = createModule<ProjectModuleDef>({
	name: "ProjectsModule",
	providers: {
		projectService: ProjectService,
		projectSummaryService: ProjectSummaryService,
	},
	components,
	componentExports: ["ProjectsPage", "ProjectPage"],
});
