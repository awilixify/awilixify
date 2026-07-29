import { transformerTwoslash } from "@shikijs/vitepress-twoslash";
import { defineConfig } from "vitepress";

const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const base =
	process.env.DOCS_BASE ??
	(process.env.GITHUB_ACTIONS === "true" && repoName ? `/${repoName}/` : "/");

const docsSidebar = [
	{
		text: "Getting Started",
		items: [
			{ text: "Quick Start", link: "/docs/quick-start" },
			{
				text: "Philosophy and Motivation",
				link: "/docs/philosophy-and-motivation",
			},
		],
	},
	{
		text: "Core DI",
		items: [
			{ text: "Providers", link: "/docs/providers" },
			{ text: "Native Decorators", link: "/docs/native-decorators" },
			{ text: "Initializers", link: "/docs/initializers" },
			{ text: "Interceptors", link: "/docs/interceptors" },
			{ text: "Lifecycle", link: "/docs/lifecycle" },
		],
	},
	{
		text: "Modules",
		items: [
			{ text: "Global Modules", link: "/docs/global-modules" },
			{ text: "Dynamic Modules", link: "/docs/dynamic-modules" },
			{ text: "Async Modules", link: "/docs/async-modules" },
			{
				text: "Circular Dependencies",
				link: "/docs/circular-dependencies",
			},
			{ text: "Testing", link: "/docs/testing" },
		],
	},
	{
		text: "Frontend",
		items: [
			{ text: "Overview", link: "/docs/frontend-overview" },
			{ text: "React", link: "/docs/react" },
		],
	},
	{
		text: "CQRS",
		items: [
			{ text: "Why CQRS?", link: "/docs/why-cqrs" },
			{ text: "CQRS Quick Start", link: "/docs/cqrs-quick-start" },
			{ text: "Handlers", link: "/docs/cqrs-handlers" },
			{ text: "Contracts", link: "/docs/cqrs-contracts" },
			{ text: "Mediator", link: "/docs/cqrs-mediator" },
			{ text: "ExecutionContext", link: "/docs/cqrs-execution-context" },
			{ text: "Pre-Handlers", link: "/docs/cqrs-pre-handlers" },
			{ text: "Scenarios", link: "/docs/cqrs-scenarios" },
			{
				text: "Error and Context Merging",
				link: "/docs/cqrs-error-merging-result",
			},
		],
	},
	{
		text: "Recipes",
		items: [
			{ text: "Integrations", link: "/docs/integrations" },
			{
				text: "HTTP Exception Handling",
				link: "/docs/http-exception-handling",
			},
			{
				text: "Type-safe Request/Response",
				link: "/docs/recipes-type-safe-request-response",
			},
			{ text: "Result vs throw", link: "/docs/recipes-result" },
			{
				text: "App Error to HTTP Error",
				link: "/docs/recipes-error-to-http-mapping",
			},
			{
				text: "Kysely Read/Write scopes",
				link: "/docs/recipes-db-kysely-module-scope",
			},
			{ text: "OpenAPI", link: "/docs/recipes-openapi" },
		],
	},
];

export default defineConfig({
	title: "awilixify",
	description: "Transport-agnostic modular DI and CQRS framework for Awilix",
	base,
	lang: "en-US",
	cleanUrls: true,
	lastUpdated: true,
	head: [
		["link", { rel: "icon", href: `${base}favicon.ico`, sizes: "any" }],
		["link", { rel: "icon", type: "image/png", href: `${base}favicon.png` }],
		["link", { rel: "apple-touch-icon", href: `${base}apple-touch-icon.png` }],
	],
	rewrites: {
		"guide/:slug*": "docs/:slug*",
	},
	themeConfig: {
		logo: "/logo.png",
		sidebar: {
			"/docs/": docsSidebar,
		},
		socialLinks: [
			{ icon: "github", link: "https://github.com/awilixify/awilixify" },
		],
	},
	markdown: {
		codeTransformers: [
			transformerTwoslash({
				tsconfigPath: "./docs/.vitepress/tsconfig.twoslash.json",
				twoslashOptions: {
					extraFiles: {
						"/node_modules/awilixify/index.d.ts": `
declare module "awilixify" {
	export type ModuleDef<T> = T & { deps: Record<string, any> };
	export function createModule<T>(def: any): any;
	export const DIContext: {
		create: (module: unknown, options: { framework: unknown; globalModules?: unknown[] }) => void;
	};
}
						`,
					},
				},
			}),
		],
	},
});
