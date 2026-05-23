import {
	createRootRoute,
	createRoute,
	createRouter,
	type RouteComponent,
} from "@tanstack/react-router";

export type AppRouterComponents = {
	AppShell: RouteComponent;
	ProjectsPage: RouteComponent;
	ProjectPage: RouteComponent;
	AboutPage: RouteComponent;
};

export function createAppRouter({
	AppShell,
	ProjectsPage,
	ProjectPage,
	AboutPage,
}: AppRouterComponents) {
	const rootRoute = createRootRoute({
		component: AppShell,
	});

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
	const aboutRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/about",
		component: AboutPage,
	});

	return createRouter({
		routeTree: rootRoute.addChildren([indexRoute, projectRoute, aboutRoute]),
	});
}

export type AppRouter = ReturnType<typeof createAppRouter>;

declare module "@tanstack/react-router" {
	interface Register {
		router: AppRouter;
	}
}
