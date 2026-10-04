import fs from "fs-extra";
import { CURRENT_SPEC_VERSION, getSchema, validateStrict } from "ctrf";
import type { CTRFReport, Test, Tool, RetryAttempt } from "ctrf";
import type { JUnitTestCase, JUnitRetryAttempt } from "../types/junit.js";
import { readJUnitReportsFromGlob } from "./read.js";
import path from "node:path";

/**
 * Options for the conversion
 */
export interface ConvertOptions {
	outputPath?: string;
	toolName?: string;
	envProps?: string[];
	useSuiteName?: boolean;
	log?: boolean;
}

/**
 * Convert JUnit XML report(s) to CTRF
 * @param pattern - Path to JUnit XML file or glob pattern
 * @param options - Optional options for the conversion
 * @returns Promise that resolves when the conversion is complete
 */
export async function convertJUnitToCTRFReport(
	pattern: string,
	options: ConvertOptions = {},
): Promise<CTRFReport | null> {
	const { outputPath, toolName, envProps, useSuiteName } = options;
	const testCases = await readJUnitReportsFromGlob(pattern, {
		log: options.log,
	});
	const envPropsObj = envProps
		? Object.fromEntries(
				envProps.map((prop) => {
					const separator = prop.indexOf("=");
					if (separator < 1)
						throw new Error("Environment properties must use key=value");
					return [prop.slice(0, separator), prop.slice(separator + 1)];
				}),
			)
		: {};

	if (testCases.length === 0) {
		console.warn(
			"No test cases found in the provided path. No CTRF report generated.",
		);
		return null;
	}

	if (options.log)
		console.log(`Converting ${testCases.length} test cases to CTRF format`);
	const ctrfReport = createCTRFReport(
		testCases,
		toolName,
		envPropsObj,
		useSuiteName,
	);

	if (outputPath) {
		const finalOutputPath = path.resolve(outputPath);
		const outputDir = path.dirname(finalOutputPath);
		await fs.ensureDir(outputDir);

		if (options.log) console.log("Writing CTRF report to:", finalOutputPath);

		const jsonString = serializeCTRFReport(ctrfReport);
		await fs.writeFile(finalOutputPath, jsonString, "utf-8");

		if (options.log) console.log(`CTRF report written to ${outputPath}`);
	}
	return ctrfReport;
}

/**
 * Safely serialize a CTRF report to JSON with detailed error diagnostics
 * @param report - The CTRF report to serialize
 * @returns JSON string representation of the report
 * @throws Error with detailed diagnostics if serialization fails
 */
function serializeCTRFReport(report: CTRFReport): string {
	try {
		return JSON.stringify(report, null, 2);
	} catch (error) {
		console.error("Failed to serialize CTRF report to JSON:");
		console.error(error instanceof Error ? error.message : String(error));

		try {
			JSON.stringify(report.results.summary);
			console.log("Summary serialization: OK");
		} catch {
			console.error("Summary contains invalid data");
		}

		try {
			JSON.stringify(report.results.tool);
			console.log("Tool serialization: OK");
		} catch {
			console.error("Tool contains invalid data");
		}

		try {
			JSON.stringify(report.results.environment);
			console.log("Environment serialization: OK");
		} catch {
			console.error("Environment contains invalid data");
		}

		for (let i = 0; i < report.results.tests.length; i++) {
			try {
				JSON.stringify(report.results.tests[i]);
			} catch {
				console.error(
					`Test at index ${i} contains invalid data:`,
					report.results.tests[i].name,
				);
			}
		}

		throw error;
	}
}

/**
 * Sanitize a string to ensure it's valid for JSON serialization
 * Removes or escapes problematic characters that could break JSON parsing
 * @param str - String to sanitize
 * @returns Sanitized string safe for JSON
 */
export function sanitizeString(str?: string): string | undefined {
	if (str == null) return undefined;

	let s = str;
	// Remove BOM if present
	s = s.replace(/\uFEFF/g, "");
	// Replace control chars except \n, \r, \t and remove DEL
	// eslint-disable-next-line no-control-regex
	s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ");
	// Replace isolated surrogate halves with replacement char
	s = s.replace(/[\uD800-\uDFFF]/g, "�");
	// Normalize Unicode to NFC
	try {
		s = s.normalize("NFC");
	} catch {
		// Ignore if normalization fails
	}

	if (/^\s*$/.test(s)) return undefined;

	return s;
}

/**
 * Convert JUnit output string to CTRF stdout/stderr array
 * Splits on newlines, sanitizes each line, and filters out empty lines for cleaner output
 * @param output - Raw output string from JUnit
 * @returns Array of non-empty sanitized output lines
 */
function convertOutputToArray(
	output: string | undefined,
): string[] | undefined {
	if (!output || output.trim() === "") {
		return undefined;
	}

	return output
		.split("\n")
		.map((line) => sanitizeString(line.trim()))
		.filter((line) => line && line.length > 0) as string[];
}

/**
 * Convert JUnit retry attempts to CTRF retry attempts
 * @param retryAttempts - Array of JUnit retry attempts
 * @param startAttempt - Starting attempt number
 * @returns Array of CTRF RetryAttempt objects
 */
function convertRetryAttempts(
	retryAttempts: JUnitRetryAttempt[],
	startAttempt: number,
): RetryAttempt[] {
	return retryAttempts.map((attempt, index) => {
		const retryAttempt: RetryAttempt = {
			attempt: startAttempt + index,
			status: "failed" as const,
			message: sanitizeString(attempt.message),
			trace: sanitizeString(attempt.trace),
		};

		const stdout = convertOutputToArray(attempt.systemOut);
		const stderr = convertOutputToArray(attempt.systemErr);

		if (stdout) {
			retryAttempt.stdout = stdout;
		}
		if (stderr) {
			retryAttempt.stderr = stderr;
		}

		return retryAttempt;
	});
}

/**
 * Process a JUnit test case and extract retry information to determine final test status
 * @param testCase - JUnit test case with potential retry information
 * @returns Object containing test information including retry details and final status
 */
function processTestWithRetries(testCase: JUnitTestCase): {
	retryAttempts: RetryAttempt[];
	retryCount: number;
	finalStatus: Test["status"];
	isFlaky: boolean;
	finalAttempt?: JUnitRetryAttempt;
} {
	const flaky = testCase.flakyAttempts ?? [
		...(testCase.flakyFailures ?? []),
		...(testCase.flakyErrors ?? []),
	];
	const reruns = testCase.rerunAttempts ?? [
		...(testCase.rerunFailures ?? []),
		...(testCase.rerunErrors ?? []),
	];
	if (flaky.length > 0) {
		return {
			retryAttempts: convertRetryAttempts(flaky, 1),
			retryCount: flaky.length,
			finalStatus: "passed",
			isFlaky: true,
		};
	}
	if (reruns.length > 0) {
		const original: JUnitRetryAttempt = {
			message: testCase.failureMessage ?? testCase.errorMessage,
			trace: testCase.failureTrace ?? testCase.errorTrace,
			systemOut: testCase.systemOut,
			systemErr: testCase.systemErr,
		};
		return {
			retryAttempts: convertRetryAttempts(
				[original, ...reruns.slice(0, -1)],
				1,
			),
			retryCount: reruns.length,
			finalStatus: "failed",
			isFlaky: false,
			finalAttempt: reruns[reruns.length - 1],
		};
	}
	return {
		retryAttempts: [],
		retryCount: 0,
		finalStatus:
			testCase.hasFailure || testCase.hasError
				? "failed"
				: testCase.skipped
					? "skipped"
					: "passed",
		isFlaky: false,
	};
}

function convertToCTRFTest(
	testCase: JUnitTestCase,
	useSuiteName: boolean,
): Test {
	const testInfo = processTestWithRetries(testCase);

	const durationMs = Math.round(parseFloat(testCase.time || "0") * 1000);

	const suiteAsArray: string[] = [];
	const suite = sanitizeString(testCase.suite);

	if (testCase.suite !== undefined) {
		if (suite !== undefined) {
			suiteAsArray.push(suite);
		}
	}

	const testName = useSuiteName
		? `${sanitizeString(testCase.suite)}: ${sanitizeString(testCase.name)}`
		: sanitizeString(testCase.name);

	const line = testCase.lineno ? parseInt(testCase.lineno, 10) : undefined;

	const test: Test = {
		name: testName || "Unnamed Test",
		status: testInfo.finalStatus,
		duration: durationMs,
		filePath: testCase.file,
		line: line,
		message:
			sanitizeString(
				testInfo.finalAttempt
					? testInfo.finalAttempt.message
					: testCase.failureMessage || testCase.errorMessage,
			) || undefined,
		trace:
			sanitizeString(
				testInfo.finalAttempt
					? testInfo.finalAttempt.trace
					: testCase.failureTrace || testCase.errorTrace,
			) || undefined,
		suite: suiteAsArray.length > 0 ? suiteAsArray : undefined,
	};

	if (testInfo.retryCount > 0) {
		test.retries = testInfo.retryCount;
		test.retryAttempts = testInfo.retryAttempts;
	}

	if (testInfo.isFlaky) {
		test.flaky = true;
	}

	const stdout = convertOutputToArray(
		testInfo.finalAttempt
			? testInfo.finalAttempt.systemOut
			: testCase.systemOut,
	);
	const stderr = convertOutputToArray(
		testInfo.finalAttempt
			? testInfo.finalAttempt.systemErr
			: testCase.systemErr,
	);

	if (stdout) {
		test.stdout = stdout;
	}
	if (stderr) {
		test.stderr = stderr;
	}

	return test;
}

export function createCTRFReport(
	testCases: JUnitTestCase[],
	toolName?: string,
	envProps?: Record<string, string>,
	useSuiteName?: boolean,
): CTRFReport {
	const ctrfTests = testCases.map((testCase) =>
		convertToCTRFTest(testCase, !!useSuiteName),
	);
	const passed = ctrfTests.filter((test) => test.status === "passed").length;
	const failed = ctrfTests.filter((test) => test.status === "failed").length;
	const skipped = ctrfTests.filter((test) => test.status === "skipped").length;
	const pending = ctrfTests.filter((test) => test.status === "pending").length;
	const other = ctrfTests.filter((test) => test.status === "other").length;
	const flaky = ctrfTests.filter((test) => test.flaky === true).length;

	const summary = {
		tests: ctrfTests.length,
		passed,
		failed,
		skipped,
		pending,
		other,
		start: 0,
		stop: 0,
		...(flaky > 0 && { flaky }),
	};

	const tool: Tool = {
		name: toolName || "junit-to-ctrf",
	};

	const report: CTRFReport = {
		reportFormat: "CTRF",
		specVersion: CURRENT_SPEC_VERSION,
		generatedBy: "junit-to-ctrf",
		timestamp: new Date().toISOString(),
		results: {
			tool,
			summary,
			tests: ctrfTests,
		},
	};

	if (envProps && Object.keys(envProps).length > 0) {
		const properties = (
			getSchema(CURRENT_SPEC_VERSION) as {
				properties: {
					results: {
						properties: {
							environment: { properties: Record<string, unknown> };
						};
					};
				};
			}
		).properties.results.properties.environment.properties;
		const environment: Record<string, unknown> = {};
		const extra: Record<string, string> = {};
		for (const [key, value] of Object.entries(envProps)) {
			if (key === "buildNumber") {
				const buildNumber = Number(value);
				if (value.trim() === "" || !Number.isSafeInteger(buildNumber))
					throw new Error("buildNumber must be an integer");
				environment.buildNumber = buildNumber;
			} else if (key !== "extra" && Object.hasOwn(properties, key)) {
				environment[key] = value;
			} else {
				extra[key] = value;
			}
		}
		if (Object.keys(extra).length > 0) environment.extra = extra;
		report.results.environment = environment;
	}

	validateStrict(report, { specVersion: CURRENT_SPEC_VERSION });
	return report;
}
