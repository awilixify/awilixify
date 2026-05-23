export type Project = {
	id: string;
	name: string;
	status: "active" | "paused";
	owner: string;
};
