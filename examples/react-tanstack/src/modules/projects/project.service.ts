import type { Project } from "./project.types";

const projects: Project[] = [
	{
		id: "billing",
		name: "Billing API",
		status: "active",
		owner: "Platform",
	},
	{
		id: "checkout",
		name: "Checkout UI",
		status: "active",
		owner: "Commerce",
	},
	{
		id: "reporting",
		name: "Reporting",
		status: "paused",
		owner: "Data",
	},
];

export class ProjectService {
	async list(): Promise<Project[]> {
		await new Promise((resolve) => setTimeout(resolve, 150));

		return projects;
	}

	async get(id: string): Promise<Project | undefined> {
		await new Promise((resolve) => setTimeout(resolve, 150));

		return projects.find((project) => project.id === id);
	}
}
