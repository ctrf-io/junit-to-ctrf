import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		reporters: ["default", "./tests/reporters/vitest.mjs"],
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			exclude: [
				"node_modules/",
				"dist/",
				"coverage/",
				"**/*.d.ts",
				"**/*.test.ts",
				"**/*.spec.ts",
				"test-helpers/",
				"ctrf/",
			],
		},
		environment: "node",
		globals: false,
		include: ["src/**/*.{test,spec}.{js,ts}", "tests/native/*.test.mjs"],
		exclude: ["node_modules/", "dist/", "coverage/"],
	},
});
