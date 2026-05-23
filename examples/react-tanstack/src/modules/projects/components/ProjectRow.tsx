import { Link } from "@tanstack/react-router";
import type { WithDeps } from "awilixify/react";
import type { Project } from "../project.types";
import type { Deps } from "../projects.module";

export type ProjectRowProps = {
  project: Project;
};

export function ProjectRow({ project, deps }: WithDeps<ProjectRowProps, Deps>) {
  return (
    <Link
      className="projectRow"
      params={{ projectId: project.id }}
      to="/projects/$projectId"
    >
      <strong>{project.name}</strong>
      <span>{project.owner}</span>
      <deps.StatusBadge status={project.status} />
    </Link>
  );
}
