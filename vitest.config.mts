import { defineConfig } from "vitest/config";

export default defineConfig({
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
