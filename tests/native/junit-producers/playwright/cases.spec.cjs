const { test, expect } = require("@playwright/test");
test.describe("native suite", () => {
	test("pass ✓", () => {
		console.log("playwright pass output");
		expect(2 + 2).toBe(4);
	});
	test("failure", () => {
		throw new Error("playwright fixture failure");
	});
	test.skip("skipped", () => {});
	test("retry recovery", ({ browserName }, info) => {
		console.log(`playwright attempt ${info.retry}`);
		expect(browserName).toBe("chromium");
		expect(info.retry).toBe(1);
	});
});
