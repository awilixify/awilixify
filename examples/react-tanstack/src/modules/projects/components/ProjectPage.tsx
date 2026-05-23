import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import type { WithDepsOnly } from "awilixify/react";
import type { Deps } from "../projects.module";

export function ProjectPage({ deps }: WithDepsOnly<Deps>) {
  const { projectId } = useParams({ from: "/projects/$projectId" });
  const navigate = useNavigate({ from: "/projects/$projectId" });

  const projectQuery = useQuery({
    queryKey: ["projects", projectId],
    queryFn: () => deps.projectService.get(projectId),
  });

  if (projectQuery.isPending) {
    return <p className="muted">Loading project...</p>;
  }

  if (!projectQuery.data) {
    return (
      <section className="panel compact">
        <p className="error">Project not found.</p>
        <button type="button" onClick={() => void navigate({ to: "/" })}>
          Back to projects
        </button>
      </section>
    );
  }

  return (
    <section className="panel compact">
      <Link className="backLink" to="/">
        Back to projects
      </Link>
      <h2>{projectQuery.data.name}</h2>
      <dl>
        <div>
          <dt>Status</dt>
          <dd>
            <deps.StatusBadge status={projectQuery.data.status} />
          </dd>
        </div>
        <div>
          <dt>Owner</dt>
          <dd>{projectQuery.data.owner}</dd>
        </div>
      </dl>
    </section>
  );
}
