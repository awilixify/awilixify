import type { WithDeps } from "awilixify/react";
import type { Project } from "../project.types";
import type { Deps } from "../projects.module";

export type StatusBadgeProps = {
  status: Project["status"];
};

export function StatusBadge({ status }: WithDeps<StatusBadgeProps, Deps>) {
  return <span className={`status ${status}`}>{status}</span>;
}
