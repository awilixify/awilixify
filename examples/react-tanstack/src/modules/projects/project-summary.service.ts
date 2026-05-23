import type { ProviderDeps } from "./projects.module";

export type ProjectSummary = {
	total: number;
	active: number;
	paused: number;
};

export class ProjectSummaryService {
	constructor(
		private readonly projectService: ProviderDeps["projectService"],
	) {}

	async getSummary(): Promise<ProjectSummary> {
		const projects = await this.projectService.list();

		return projects.reduce<ProjectSummary>(
			(summary, project) => ({
				total: summary.total + 1,
				active: summary.active + (project.status === "active" ? 1 : 0),
				paused: summary.paused + (project.status === "paused" ? 1 : 0),
			}),
			{ total: 0, active: 0, paused: 0 },
		);
	}
}
