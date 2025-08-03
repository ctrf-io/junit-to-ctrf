import { describe, it, expect } from "vitest";
import { createCTRFReport } from "./convert.js";
import type { JUnitTestCase } from "../types/junit.js";

describe("createCTRFReport", () => {
  const mockTestCases: JUnitTestCase[] = [
    {
      suite: "TestSuite1",
      classname: "TestClass1",
      name: "testPassed",
      time: "0.5",
      hasFailure: false,
      failureTrace: undefined,
      failureMessage: undefined,
      failureType: undefined,
      hasError: false,
      errorTrace: undefined,
      errorMessage: undefined,
      errorType: undefined,
      file: "test1.js",
      lineno: "10",
      skipped: false,
    },
    {
      suite: "TestSuite1",
      classname: "TestClass1",
      name: "testFailed",
      time: "1.2",
      hasFailure: true,
      failureTrace: "Error: Test failed\n    at testFailed (test1.js:15:5)",
      failureMessage: "Test failed",
      failureType: "Error",
      hasError: false,
      errorTrace: undefined,
      errorMessage: undefined,
      errorType: undefined,
      file: "test1.js",
      lineno: "15",
      skipped: false,
    },
    {
      suite: "TestSuite2",
      classname: "TestClass2",
      name: "testSkipped",
      time: "0.1",
      hasFailure: false,
      failureTrace: undefined,
      failureMessage: undefined,
      failureType: undefined,
      hasError: false,
      errorTrace: undefined,
      errorMessage: undefined,
      errorType: undefined,
      file: "test2.js",
      lineno: "20",
      skipped: true,
    },
  ];

  it("should create a valid CTRF report with basic test cases", () => {
    const report = createCTRFReport(mockTestCases);

    expect(report).toMatchObject({
      reportFormat: "CTRF",
      specVersion: "0.0.0",
      generatedBy: "junit-to-ctrf",
      results: {
        tool: {
          name: "junit-to-ctrf",
        },
        summary: {
          tests: 3,
          passed: 1,
          failed: 1,
          skipped: 1,
          pending: 0,
          other: 0,
          start: 0,
          stop: 0,
        },
        tests: expect.arrayContaining([
          expect.objectContaining({
            name: "testPassed",
            status: "passed",
            duration: 500,
            filePath: "test1.js",
            line: 10,
            suite: "TestSuite1",
          }),
          expect.objectContaining({
            name: "testFailed",
            status: "failed",
            duration: 1200,
            filePath: "test1.js",
            line: 15,
            message: "Test failed",
            trace: "Error: Test failed\n    at testFailed (test1.js:15:5)",
            suite: "TestSuite1",
          }),
          expect.objectContaining({
            name: "testSkipped",
            status: "skipped",
            duration: 100,
            filePath: "test2.js",
            line: 20,
            suite: "TestSuite2",
          }),
        ]),
      },
    });

    expect(report.timestamp).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
  });

  it("should use custom tool name when provided", () => {
    const report = createCTRFReport(mockTestCases, "custom-tool");

    expect(report.results.tool).toEqual({
      name: "custom-tool",
    });
  });

  it("should include environment properties when provided", () => {
    const envProps = {
      nodeVersion: "18.0.0",
      platform: "darwin",
    };

    const report = createCTRFReport(mockTestCases, undefined, envProps);

    expect(report.results.environment).toEqual(envProps);
  });

  it("should not include environment when not provided", () => {
    const report = createCTRFReport(mockTestCases);

    expect(report.results.environment).toBeUndefined();
  });

  it("should include suite name in test name when useSuiteName is true", () => {
    const report = createCTRFReport(mockTestCases, undefined, undefined, true);

    const tests = report.results.tests;
    expect(tests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "TestSuite1: testPassed",
        }),
        expect.objectContaining({
          name: "TestSuite1: testFailed",
        }),
        expect.objectContaining({
          name: "TestSuite2: testSkipped",
        }),
      ]),
    );
  });

  it("should not include suite name in test name when useSuiteName is false", () => {
    const report = createCTRFReport(mockTestCases, undefined, undefined, false);

    const tests = report.results.tests;
    expect(tests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "testPassed",
        }),
        expect.objectContaining({
          name: "testFailed",
        }),
        expect.objectContaining({
          name: "testSkipped",
        }),
      ]),
    );
  });

  it("should handle test cases with missing optional fields", () => {
    const minimalTestCases: JUnitTestCase[] = [
      {
        suite: "TestSuite",
        classname: "TestClass",
        name: "testMinimal",
        time: "0.3",
        hasFailure: false,
        failureTrace: undefined,
        failureMessage: undefined,
        failureType: undefined,
        hasError: false,
        errorTrace: undefined,
        errorMessage: undefined,
        errorType: undefined,
        skipped: false,
      },
    ];

    const report = createCTRFReport(minimalTestCases);

    expect(report.results.tests).toEqual([
      expect.objectContaining({
        name: "testMinimal",
        status: "passed",
        duration: 300,
        filePath: undefined,
        line: undefined,
        message: undefined,
        trace: undefined,
        suite: "TestSuite",
      }),
    ]);
  });

  it("should handle test cases with error instead of failure", () => {
    const errorTestCases: JUnitTestCase[] = [
      {
        suite: "TestSuite",
        classname: "TestClass",
        name: "testWithError",
        time: "0.8",
        hasFailure: false,
        failureTrace: undefined,
        failureMessage: undefined,
        failureType: undefined,
        hasError: true,
        errorTrace:
          "TypeError: Cannot read property of undefined\n    at testWithError (test.js:25:10)",
        errorMessage: "Cannot read property of undefined",
        errorType: "TypeError",
        file: "test.js",
        lineno: "25",
        skipped: false,
      },
    ];

    const report = createCTRFReport(errorTestCases);

    expect(report.results.tests).toEqual([
      expect.objectContaining({
        name: "testWithError",
        status: "failed",
        duration: 800,
        filePath: "test.js",
        line: 25,
        message: "Cannot read property of undefined",
        trace:
          "TypeError: Cannot read property of undefined\n    at testWithError (test.js:25:10)",
        suite: "TestSuite",
      }),
    ]);
  });

  it("should handle empty test cases array", () => {
    const report = createCTRFReport([]);

    expect(report.results.summary).toEqual({
      tests: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      pending: 0,
      other: 0,
      start: 0,
      stop: 0,
    });

    expect(report.results.tests).toEqual([]);
  });

  it("should correctly calculate summary statistics", () => {
    const mixedTestCases: JUnitTestCase[] = [
      // Passed test
      {
        suite: "Suite1",
        classname: "Class1",
        name: "test1",
        time: "0.1",
        hasFailure: false,
        failureTrace: undefined,
        failureMessage: undefined,
        failureType: undefined,
        hasError: false,
        errorTrace: undefined,
        errorMessage: undefined,
        errorType: undefined,
        skipped: false,
      },
      // Failed test
      {
        suite: "Suite1",
        classname: "Class1",
        name: "test2",
        time: "0.2",
        hasFailure: true,
        failureTrace: "Error",
        failureMessage: "Failed",
        failureType: "Error",
        hasError: false,
        errorTrace: undefined,
        errorMessage: undefined,
        errorType: undefined,
        skipped: false,
      },
      // Skipped test
      {
        suite: "Suite1",
        classname: "Class1",
        name: "test3",
        time: "0.0",
        hasFailure: false,
        failureTrace: undefined,
        failureMessage: undefined,
        failureType: undefined,
        hasError: false,
        errorTrace: undefined,
        errorMessage: undefined,
        errorType: undefined,
        skipped: true,
      },
    ];

    const report = createCTRFReport(mixedTestCases);

    expect(report.results.summary).toEqual({
      tests: 3,
      passed: 1,
      failed: 1,
      skipped: 1,
      pending: 0,
      other: 0,
      start: 0,
      stop: 0,
    });
  });
});
