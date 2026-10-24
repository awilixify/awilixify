import { fileURLToPath } from "node:url";
import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
	oxc: false,
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./src", import.meta.url)),
		},
	},
	plugins: [
		swc.vite({
			jsc: {
				transform: { decoratorVersion: "2022-03" },
				parser: {
					syntax: "typescript",
					// Node cannot parse raw Stage 3 decorators yet,
					// and default oxc transformer doesn't support Stage 3 decorators.
					// So swc to the rescue
					decorators: true,
				},
			},
		}),
	],
	test: {
		include: ["src/**/*.test.ts"],
	},
});
