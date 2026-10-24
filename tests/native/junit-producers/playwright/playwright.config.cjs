const path = require("node:path");
module.exports = {
	testDir: __dirname,
	testMatch: "cases.spec.cjs",
	workers: 1,
	retries: 1,
	reporter: [
		["junit", { outputFile: path.join(__dirname, "..", "playwright.xml") }],
		[
			"json",
			{ outputFile: path.join(__dirname, "..", "playwright-native.json") },
		],
	],
};
