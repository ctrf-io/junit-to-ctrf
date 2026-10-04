import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validateStrict } from "ctrf";
import { convertJUnitToCTRFReport } from "./convert.js";

const fixtures = [
	"test-junit.xml",
	"test-junit-nested.xml",
	"test-minitest-junit.xml",
	"test-surefire.xml",
	"test-surefire-flaky.xml",
	"test-surefire-retry.xml",
	"test-junit-problem-string.xml",
];

describe("CTRF 0.1.0 conversion", () => {
	it.each(fixtures)(
		"strictly validates real XML fixture %s",
		async (fixture) => {
			const report = await convertJUnitToCTRFReport(`reports/${fixture}`, {
				envProps: [
					"buildNumber=0",
					"nodeVersion=24",
					"buildUrl=https://example.com/build?x=y",
				],
			});
			expect(report?.specVersion).toBe("0.1.0");
			expect(report?.results.environment?.buildNumber).toBe(0);
			expect(report?.results.environment?.extra).toEqual({ nodeVersion: "24" });
			expect(report?.results.environment?.buildUrl).toBe(
				"https://example.com/build?x=y",
			);
			expect(() =>
				validateStrict(JSON.parse(JSON.stringify(report)), {
					specVersion: "0.1.0",
				}),
			).not.toThrow();
		},
	);
	it("uses the initial attempt in history and the final rerun as the failed result", async () => {
		const report = await convertJUnitToCTRFReport(
			"reports/test-surefire-retry.xml",
		);
		const test = report?.results.tests[0];
		expect(test?.retryAttempts?.map((attempt) => attempt.attempt)).toEqual([
			1, 2,
		]);
		expect(test?.retryAttempts?.[0].stdout?.join("\n")).toContain(
			"Run 1 output",
		);
		expect(test?.retryAttempts?.[1].stdout?.join("\n")).toContain(
			"Run 2 output",
		);
		expect(test?.stdout?.join("\n")).toContain("Run 3 output");
		expect(test?.message).toBe("NullPointerException occurred");
	});
	it("preserves XML order when failure and error retries alternate", async () => {
		const directory = await fs.mkdtemp(path.join(os.tmpdir(), "junit-order-"));
		const file = path.join(directory, "report.xml");
		try {
			await fs.writeFile(
				file,
				'<testsuite name="suite"><testcase name="test" classname="suite" time="1"><failure message="initial"/><rerunError message="second"/><rerunFailure message="third"/><rerunError message="final"/></testcase></testsuite>',
			);
			const report = await convertJUnitToCTRFReport(file);
			const test = report?.results.tests[0];
			expect(test?.retryAttempts?.map((attempt) => attempt.message)).toEqual([
				"initial",
				"second",
				"third",
			]);
			expect(test?.message).toBe("final");
			expect(test?.retries).toBe(3);
			expect(() => validateStrict(report)).not.toThrow();
		} finally {
			await fs.rm(directory, { recursive: true });
		}
	});
	it.each(["", "3abc", "1.5"])(
		"rejects invalid buildNumber %s",
		async (value) => {
			await expect(
				convertJUnitToCTRFReport("reports/test-junit.xml", {
					envProps: [`buildNumber=${value}`],
				}),
			).rejects.toThrow("buildNumber must be an integer");
		},
	);
});
