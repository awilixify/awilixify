import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import type { WithDepsOnly } from "awilixify/react";
import { useRef } from "react";
import type { Deps } from "./app.module";
import type { AppRouter } from "./app-router";
import { createAppRouter } from "./app-router";

export function App({ deps }: WithDepsOnly<Deps>) {
  const routerRef = useRef<AppRouter | null>(null);

  if (!routerRef.current) {
    routerRef.current = createAppRouter({
      AppShell: deps.AppShell,
      ProjectsPage: deps.ProjectsPage,
      ProjectPage: deps.ProjectPage,
      AboutPage: deps.AboutPage,
    });
  }

  return (
    <QueryClientProvider client={deps.queryClient}>
      <RouterProvider router={routerRef.current} />
    </QueryClientProvider>
  );
}
