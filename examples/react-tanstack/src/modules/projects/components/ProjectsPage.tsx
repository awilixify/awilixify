import { useQuery } from "@tanstack/react-query";
import type { WithDepsOnly } from "awilixify/react";
import type { Deps } from "../projects.module";

export function ProjectsPage({ deps }: WithDepsOnly<Deps>) {
  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: () => deps.projectService.list(),
  });
  const summaryQuery = useQuery({
    queryKey: ["projects", "summary"],
    queryFn: () => deps.projectSummaryService.getSummary(),
  });

  if (projectsQuery.isPending) {
    return <p className="muted">Loading projects...</p>;
  }

  if (projectsQuery.isError) {
    return <p className="error">Failed to load projects.</p>;
  }

  return (
    <section className="panel">
      <div className="panelHeader">
        <div>
          <h2>Projects</h2>
          <p className="muted">Components receive awilixify deps.</p>
        </div>
        <span>
          {summaryQuery.data
            ? `${summaryQuery.data.active} active / ${summaryQuery.data.paused} paused`
            : `${projectsQuery.data.length} total`}
        </span>
      </div>
      <div className="projectList">
        {projectsQuery.data.map((project) => (
          <deps.ProjectRow key={project.id} project={project} />
        ))}
      </div>
    </section>
  );
}
