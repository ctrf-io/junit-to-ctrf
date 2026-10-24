import { describe, it, expect } from "vitest";
let attempt = 0;
describe("native suite", () => {
	it("pass ✓", () => {
		console.log("vitest pass output");
		expect(2 + 2).toBe(4);
	});
	it("failure", () => {
		throw new Error("vitest fixture failure");
	});
	it.skip("skipped", () => {});
	it("retry recovery", { retry: 1 }, () => {
		expect(attempt++).toBe(1);
	});
});
