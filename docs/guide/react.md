# React

`awilixify/react` brings the module model to React applications.

React modules register two kinds of things:

- `providers`: services, clients, stores, repositories, and other non-UI objects
- `components`: React components that should receive system-injected deps

Components receive a `deps` prop from `ReactDIContext`. Application code renders
those components with their own public props only.

For the motivation behind frontend DI, see [Frontend Overview](/docs/frontend-overview).

## Install

`react` is an optional peer dependency of `awilixify`.

```bash
npm install awilix awilixify react react-dom
```

## Dependency Surfaces

React modules infer two dependency maps from the same module definition.

`InferProviderDeps<T>` is for providers:

- local providers
- exported providers from imported modules
- global dependencies

`InferComponentDeps<T>` is for components:

- everything from provider deps
- local components
- exported components from imported modules

The split is intentional. Providers should not depend on React components.
Components can compose services and other components.

```typescript
// projects/projects.module.ts
import {
  createModule,
  type InferComponentDeps,
  type InferProviderDeps,
  type ModuleDef,
} from "awilixify/react";
import { ProjectsPage } from "./components/ProjectsPage";

const components = {
  ProjectsPage,
};

export type ProjectsModuleDef = ModuleDef<{
  providers: {
    projectService: ProjectService;
    projectSummaryService: ProjectSummaryService;
  };
  components: typeof components;
  componentExportKeys: ["ProjectsPage"];
}>;

// all deps including components, used for components
export interface Deps extends InferComponentDeps<ProjectsModuleDef> {}
// all deps without components, used for providers
export interface ProviderDeps extends InferProviderDeps<ProjectsModuleDef> {}
```

Inside the module, `Deps` is the type used by React components. `ProviderDeps`
is the type used by services and other providers.

## Providers

Providers are normal awilixify providers. They should depend on other providers,
not on components.

```typescript
// projects/project.service.ts
import type { Project } from "./project.types";

const projects: Project[] = [
  { id: "billing", name: "Billing API", status: "active", owner: "Platform" },
  { id: "checkout", name: "Checkout UI", status: "active", owner: "Commerce" },
  { id: "reporting", name: "Reporting", status: "paused", owner: "Data" },
];

export class ProjectService {
  list(): Project[] {
    return projects;
  }

  get(id: string): Project | undefined {
    return projects.find((project) => project.id === id);
  }
}
```

```typescript
// projects/project-summary.service.ts
import type { ProviderDeps } from "./projects.module";

export class ProjectSummaryService {
  constructor(
    private readonly projectService: ProviderDeps["projectService"],
  ) {}

  getSummary() {
    const projects = this.projectService.list();

    return {
      total: projects.length,
      active: projects.filter((project) => project.status === "active").length,
      paused: projects.filter((project) => project.status === "paused").length,
    };
  }
}
```

`ProviderDeps["projectService"]` is inferred from the module definition. It does
not include component keys like `ProjectPage` or `StatusBadge`.

## Components

Use `WithDeps<TProps, TDeps>` when a component has public props.

```typescript
// projects/components/StatusBadge.tsx
import type { WithDeps } from "awilixify/react";
import type { Project } from "../project.types";
import type { Deps } from "../projects.module";

export type StatusBadgeProps = {
  status: Project["status"];
};

export function StatusBadge({ status }: WithDeps<StatusBadgeProps, Deps>) {
  return <span>{status}</span>;
}
```

```typescript
// projects/components/ProjectPage.tsx
import type { WithDeps } from "awilixify/react";
import type { Deps } from "../projects.module";

export type ProjectPageProps = {
  projectId: string;
};

export function ProjectPage({
  projectId,
  deps,
}: WithDeps<ProjectPageProps, Deps>) {
  const project = deps.projectService.get(projectId);

  if (!project) {
    return <p>Project not found.</p>;
  }

  return (
    <section>
      <h2>{project.name}</h2>
      <deps.StatusBadge status={project.status} />
    </section>
  );
}
```

Use `WithDepsOnly<TDeps>` when a component has no public props.

```typescript
// projects/components/ProjectsPage.tsx
import type { WithDepsOnly } from "awilixify/react";
import type { Deps } from "../projects.module";

export function ProjectsPage({ deps }: WithDepsOnly<Deps>) {
  const projects = deps.projectService.list();
  const summary = deps.projectSummaryService.getSummary();

  return (
    <section>
      <h2>Projects</h2>
      <p>
        {summary.active} active / {summary.paused} paused
      </p>

      {projects.map((project) => (
        <deps.ProjectRow key={project.id} project={project} />
      ))}
    </section>
  );
}
```

`deps` is owned by the system. It is injected when the component is resolved
from the module scope, and it cannot be supplied from JSX.

When a component is rendered from `deps`, only its public props are accepted.
The `deps` prop is removed from the public component type.

## Module Definition

Components are registered separately from providers.

`componentExports` exposes selected components to modules that import this
module. It is usually used for pages, route targets, or reusable UI pieces that
another module should be allowed to render.

```typescript
// projects/projects.module.ts
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

const components = {
  ProjectsPage,
  ProjectPage,
  ProjectRow,
  StatusBadge,
};

export type ProjectsModuleDef = ModuleDef<{
  providers: {
    projectService: ProjectService;
    projectSummaryService: ProjectSummaryService;
  };
  components: typeof components;
  componentExportKeys: ["ProjectsPage", "ProjectPage"];
}>;

export interface Deps extends InferComponentDeps<ProjectsModuleDef> {}
export interface ProviderDeps extends InferProviderDeps<ProjectsModuleDef> {}

export const ProjectsModule = createModule<ProjectsModuleDef>({
  name: "ProjectsModule",
  providers: {
    projectService: ProjectService,
    projectSummaryService: ProjectSummaryService,
  },
  components,
  componentExports: ["ProjectsPage", "ProjectPage"],
});
```

## Importing Components

Imported component exports become part of the importing module's component deps.
They do not become part of provider deps.

```typescript
// app/AppShell.tsx
import type { WithDepsOnly } from "awilixify/react";
import type { Deps } from "./app.module";

export function AppShell({ deps }: WithDepsOnly<Deps>) {
  return (
    <main>
      <h1>Projects</h1>
      <deps.ProjectsPage />
    </main>
  );
}
```

```typescript
// app/app.module.ts
import {
  createModule,
  type InferComponentDeps,
  type ModuleDef,
} from "awilixify/react";

import { ProjectsModule } from "../projects/projects.module";
import { AppShell } from "./AppShell";

const components = {
  AppShell,
};

export type AppModuleDef = ModuleDef<{
  imports: [typeof ProjectsModule];
  components: typeof components;
}>;

export interface Deps extends InferComponentDeps<AppModuleDef> {}

export const AppModule = createModule<AppModuleDef>({
  name: "AppModule",
  imports: [ProjectsModule],
  components,
});
```

## Bootstrapping

Use `ReactDIContext.create(...)` to build the module graph. Components are
registered in the Awilix scope and can be resolved by key.

```typescript
import { ReactDIContext, type WithoutDeps } from "awilixify/react";
import { createRoot } from "react-dom/client";
import type { AppShell } from "./app/AppShell";
import { AppModule } from "./app/app.module";

const app = ReactDIContext.create(AppModule);
const AppShellComponent =
  app.scope.resolve<WithoutDeps<typeof AppShell>>("AppShell");

createRoot(document.getElementById("root")!).render(<AppShellComponent />);
```

For components with public props, `WithoutDeps<T>` gives the renderable public
component type.

```typescript
import { ReactDIContext, type WithoutDeps } from "awilixify/react";
import type { ProjectPage } from "./projects/components/ProjectPage";

const app = ReactDIContext.create(AppModule);
const ProjectPageComponent =
  app.scope.resolve<WithoutDeps<typeof ProjectPage>>("ProjectPage");

<ProjectPageComponent projectId="billing" />;
```

## Routing

Routers usually need React components, so router construction belongs in React
composition code rather than in providers.

With TanStack Router, keep the route tree in a normal factory function so the
router type can still be inferred:

```typescript
import {
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";

export function createAppRouter({ AppShell, ProjectsPage, ProjectPage }: Deps) {
  const rootRoute = createRootRoute({ component: AppShell });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: ProjectsPage,
  });
  const projectRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/projects/$projectId",
    component: ProjectPage,
  });

  return createRouter({
    routeTree: rootRoute.addChildren([indexRoute, projectRoute]),
  });
}

export type AppRouter = ReturnType<typeof createAppRouter>;
```

Then create the router once in the root component.

```typescript
import { RouterProvider } from "@tanstack/react-router";
import { useRef } from "react";
import type { WithDepsOnly } from "awilixify/react";
import type { Deps } from "./app.module";
import { type AppRouter, createAppRouter } from "./app-router";

export function App({ deps }: WithDepsOnly<Deps>) {
  const routerRef = useRef<AppRouter | null>(null);

  if (!routerRef.current) {
    routerRef.current = createAppRouter({
      AppShell: deps.AppShell,
      ProjectsPage: deps.ProjectsPage,
      ProjectPage: deps.ProjectPage,
    });
  }

  return <RouterProvider router={routerRef.current} />;
}
```

## Notes

- Backend-only features like controllers, handlers, pre-handlers, initializers,
  and interceptors are not part of the React API.
- Components receive dependencies through `props.deps`.
- Providers should stay UI-independent and use `InferProviderDeps<T>`.
- Components use `InferComponentDeps<T>` and can render components from `deps`.

## Example

Full working example:

- [examples/react-tanstack](https://github.com/awilixify/awilixify/tree/main/examples/react-tanstack)
