import fs from 'fs-extra';
import path from 'path';
import xml2js from 'xml2js';
import { CtrfReport, CtrfTest, Tool } from '../types/ctrf';

interface JUnitTestCase {
  suite: string;
  classname: string;
  name: string;
  time: string;
  hasFailure: boolean;
  failureTrace: string | undefined,
  failureMessage: string | undefined,
  failureType: string | undefined,
  hasError: boolean,
  errorTrace: string | undefined,
  errorMessage: string | undefined,
  errorType: string | undefined,
  file?: string,
  lineno?: string,
  skipped?: boolean;
}

async function parseJUnitReport(filePath: string): Promise<JUnitTestCase[]> {
  console.log('Reading JUnit report file:', filePath);
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
    console.warn('No test suites found in the provided file.');
  }

  return testCases;
}

function convertToCTRFTest(testCase: JUnitTestCase, useSuiteName: boolean): CtrfTest {
  let status: CtrfTest['status'] = 'other';

  if (testCase.hasFailure) {
    status = 'failed';
  } else if (testCase.hasError) {
    status = 'failed';
  } else if (testCase.skipped) {
    status = 'skipped';
  } else {
    status = 'passed';
  }

  const durationMs = Math.round(parseFloat(testCase.time || '0') * 1000);

  const testName = useSuiteName
    ? `${testCase.suite}: ${testCase.name}`
    : testCase.name;

  const line = testCase.lineno ? parseInt(testCase.lineno) : undefined;

  return {
    name: testName,
    status,
    duration: durationMs,
    filePath: testCase.file,
    line: line,
    message: testCase.failureMessage || testCase.errorMessage || undefined,
    trace: testCase.failureTrace || testCase.errorTrace || undefined,
    suite: testCase.suite || '',
  };
}

function createCTRFReport(
  testCases: JUnitTestCase[],
  toolName?: string,
  envProps?: Record<string, any>,
  useSuiteName?: boolean
): CtrfReport {
  const ctrfTests = testCases.map(testCase => convertToCTRFTest(testCase, !!useSuiteName));
  const passed = ctrfTests.filter(test => test.status === 'passed').length;
  const failed = ctrfTests.filter(test => test.status === 'failed').length;
  const skipped = ctrfTests.filter(test => test.status === 'skipped').length;
  const pending = ctrfTests.filter(test => test.status === 'pending').length;
  const other = ctrfTests.filter(test => test.status === 'other').length;

  const summary = {
    tests: ctrfTests.length,
    passed,
    failed,
    skipped,
    pending,
    other,
    start: 0,
    stop: 0,
  };

  const tool: Tool = {
    name: toolName || 'junit-to-ctrf',
  };

  const report: CtrfReport = {
    results: {
      tool,
      summary,
      tests: ctrfTests,
    }
  };

  if (envProps && Object.keys(envProps).length > 0) {
    report.results.environment = envProps;
  }

  return report;
}

export async function convertJUnitToCTRF(
  junitPath: string,
  outputPath?: string,
  toolName?: string,
  envProps?: string[],
  useSuiteName?: boolean
): Promise<void> {
  const testCases = await parseJUnitReport(junitPath);
  const envPropsObj = envProps ? Object.fromEntries(envProps.map(prop => prop.split('='))) : {};
  const ctrfReport = createCTRFReport(testCases, toolName, envPropsObj, useSuiteName);

  const defaultOutputPath = path.join('ctrf', 'ctrf-report.json');
  const finalOutputPath = path.resolve(outputPath || defaultOutputPath);

  const outputDir = path.dirname(finalOutputPath);
  await fs.ensureDir(outputDir);

  console.log('Writing CTRF report to:', finalOutputPath);
  await fs.outputJson(finalOutputPath, ctrfReport, { spaces: 2 });
}

export async function convertJUnitToCTRFReport(
  junitPath: string,
  toolName?: string,
  envProps?: string[],
  useSuiteName?: boolean
): Promise<CtrfReport> {
  const testCases = await parseJUnitReport(junitPath);
  const envPropsObj = envProps ? Object.fromEntries(envProps.map(prop => prop.split('='))) : {};
  return createCTRFReport(testCases, toolName, envPropsObj, useSuiteName);
}
