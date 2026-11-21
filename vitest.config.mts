import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
	// Oxc does not lower the standard decorators used by these tests.
	oxc: false,
	plugins: [
		swc.vite({
			jsc: {
				transform: { decoratorVersion: "2022-03" },
				parser: { syntax: "typescript", decorators: true },
			},
		}),
	],
	test: {
		include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
		coverage: {
			provider: "v8",
			exclude: ["test/http/http-test-module.ts"],
			reporter: ["text", "json", "html"],
			reportsDirectory: "./coverage",
		},
	},
});
