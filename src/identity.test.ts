import { describe, expect, it } from "vitest";
import { validateStrict } from "ctrf";
import { convertJUnitToCTRFReport } from "./convert.js";

describe("converter identity", () => {
	it("keeps logical IDs independent of display prefixing and uses distinct execution/attempt IDs", async () => {
		const one = await convertJUnitToCTRFReport(
			"reports/test-surefire-retry.xml",
			{ runId: "run", shardId: "one", useSuiteName: true },
		);
		const two = await convertJUnitToCTRFReport(
			"reports/test-surefire-retry.xml",
			{ runId: "run", shardId: "two", useSuiteName: false },
		);
		expect(one?.results.tests[0].testId).toBe(two?.results.tests[0].testId);
		expect(one?.results.tests[0].executionId).not.toBe(
			two?.results.tests[0].executionId,
		);
		expect(one?.runId).toBe(two?.runId);
		expect(one?.results.tests[0].attemptId).toBeTruthy();
		expect(
			one?.results.tests[0].retryAttempts?.map((attempt) => attempt.attemptId),
		).not.toContain(one?.results.tests[0].attemptId);
		expect(
			new Set(
				one?.results.tests[0].retryAttempts?.map(
					(attempt) => attempt.attemptId,
				),
			).size,
		).toBe(2);
		expect(one?.results.environment?.shardId).toBe("one");
		expect(() => validateStrict(one!, { specVersion: "0.2.0" })).not.toThrow();
	});
});
