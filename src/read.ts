import fs from 'fs-extra';
import xml2js from 'xml2js';
import { glob } from 'glob';

/**
 * Read JUnit report files matching a glob pattern
 * @param globPattern - The glob pattern to match JUnit XML files
 * @returns Promise resolving to an array of all test cases from all matching files
 */
export async function readJUnitReportsFromGlob(globPattern: string, options: { log?: boolean } = {}): Promise<JUnitTestCase[]> {
    if (options.log) console.log('Searching for JUnit reports matching pattern:', globPattern);

    const files = await glob(globPattern);

    if (files.length === 0) {
        if (options.log) console.warn('No files found matching the pattern:', globPattern);
        return [];
    }

    if (options.log) console.log(`Found ${files.length} JUnit report files`);

    const allTestCasesPromises = files.map(file => parseJUnitReport(file, options));
    const testCasesArrays = await Promise.all(allTestCasesPromises);

    return testCasesArrays.flat();
}

/**
 * Parse a JUnit XML report file and extract test cases
 * @param filePath - Path to the JUnit XML file
 * @returns Promise resolving to an array of test cases
 */
export async function parseJUnitReport(filePath: string, options: { log?: boolean } = {}): Promise<JUnitTestCase[]> {
    if (options.log) console.log('Reading JUnit report file:', filePath);
    const xml = await fs.readFile(filePath, 'utf-8');
    const result = await xml2js.parseStringPromise(xml);
    const testCases: JUnitTestCase[] = [];

    const parseTestSuite = (suite: any, suiteName: string) => {
        if (suite.testcase) {
            suite.testcase.forEach((testCase: any) => {
                const { classname, file, lineno, name, time } = testCase.$;

                const hasFailure = testCase.failure !== undefined;
                const failureTrace = hasFailure ? (testCase.failure[0]?._ || '') : undefined;
                const failureMessage = hasFailure ? (testCase.failure[0]?.$?.message || '') : undefined;
                const failureType = hasFailure ? (testCase.failure[0]?.$?.type || '') : undefined;

                const hasError = testCase.error !== undefined;
                const errorTrace = hasError ? (testCase.error[0]?._ || '') : undefined;
                const errorMessage = hasError ? (testCase.error[0]?.$?.message || '') : undefined;
                const errorType = hasError ? (testCase.error[0]?.$?.type || '') : undefined;

                const skipped = testCase.skipped !== undefined;
                testCases.push({
                    suite: suiteName,
                    classname,
                    name,
                    time,
                    file,
                    lineno,
                    hasFailure,
                    failureTrace,
                    failureMessage,
                    failureType,
                    hasError,
                    errorTrace,
                    errorMessage,
                    errorType,
                    skipped,
                });
            });
        }
        if (suite.testsuite) {
            suite.testsuite.forEach((nestedSuite: any) => {
                const nestedSuiteName = nestedSuite.$.name || suiteName;
                parseTestSuite(nestedSuite, nestedSuiteName);
            });
        }
    };

    if (result.testsuites && result.testsuites.testsuite) {
        result.testsuites.testsuite.forEach((suite: any) => {
            const suiteName = suite.$.name;
            parseTestSuite(suite, suiteName);
        });
    } else if (result.testsuite) {
        const suite = result.testsuite;
        const suiteName = suite.$.name;
        parseTestSuite(suite, suiteName);
    } else {
        if (options.log) console.warn('No test suites found in the provided file.');
    }

    return testCases;
}