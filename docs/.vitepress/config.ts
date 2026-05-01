import { defineConfig } from "vitepress";
import { transformerTwoslash } from "@shikijs/vitepress-twoslash";

const docsSidebar = [
	{
		text: "Core",
		items: [
			{ text: "Quick Start", link: "/docs/quick-start" },
			{ text: "Providers", link: "/docs/providers" },
			{ text: "Native Decorators", link: "/docs/native-decorators" },
			{
				text: "HTTP Exception Handling",
				link: "/docs/http-exception-handling",
			},
			{ text: "Global Modules", link: "/docs/global-modules" },
			{ text: "Dynamic Modules", link: "/docs/dynamic-modules" },
			{
				text: "Circular Dependencies",
				link: "/docs/circular-dependencies",
			},
			{
				text: "Philosophy and Motivation",
				link: "/docs/philosophy-and-motivation",
			},
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
	title: "awilix-modular",
	description:
		"HTTP-framework-agnostic modular DI and CQRS framework for Awilix",
	lang: "en-US",
	cleanUrls: true,
	lastUpdated: true,
	rewrites: {
		"guide/:slug*": "docs/:slug*",
	},
	themeConfig: {
		sidebar: {
			"/docs/": docsSidebar,
		},
		socialLinks: [
			{ icon: "github", link: "https://github.com/wildstyles/awilix-modular" },
		],
	},
	markdown: {
		codeTransformers: [
			transformerTwoslash({
				tsconfigPath: "./docs/.vitepress/tsconfig.twoslash.json",
				twoslashOptions: {
					extraFiles: {
						"/node_modules/awilix-modular/index.d.ts": `
declare module "awilix-modular" {
	export type ModuleDef<T> = T & { deps: Record<string, any> };
	export function createStaticModule<T>(def: any): any;
	export function createDynamicModule<T>(factory: (config: any) => any): { forRoot(config: any): any };
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
