export default {
	test: {
		include: ["vitest/cases.test.mjs"],
		reporters: ["junit", "json"],
		outputFile: { junit: "vitest.xml", json: "vitest-native.json" },
	},
};
