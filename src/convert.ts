import fs from 'fs-extra';
import { CtrfReport, CtrfTest, Tool } from '../types/ctrf';
import { readJUnitReportsFromGlob } from './read';
import path from 'path';

interface ConvertOptions {
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
  options: ConvertOptions = {}
): Promise<CtrfReport | null> {
  const { outputPath, toolName, envProps, useSuiteName } = options;
  const testCases = await readJUnitReportsFromGlob(pattern, { log: options.log });
  const envPropsObj = envProps ? Object.fromEntries(envProps.map(prop => prop.split('='))) : {};

  if (testCases.length === 0) {
    console.warn('No test cases found in the provided path. No CTRF report generated.');
    return null;
  }
  
  if (options.log) console.log(`Converting ${testCases.length} test cases to CTRF format`);
  const ctrfReport = createCTRFReport(testCases, toolName, envPropsObj, useSuiteName);
  
  if (outputPath) {
  const finalOutputPath = path.resolve(outputPath)
  const outputDir = path.dirname(finalOutputPath);
  await fs.ensureDir(outputDir);

  if (options.log) console.log('Writing CTRF report to:', finalOutputPath);
  await fs.outputJson(finalOutputPath, ctrfReport, { spaces: 2 });
  if (options.log) console.log(`CTRF report written to ${outputPath}`);
  }
  return ctrfReport;
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