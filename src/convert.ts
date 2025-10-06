import fs from 'fs-extra'
import type { Report, Test, Tool, RetryAttempt } from 'ctrf'
import type { JUnitTestCase, JUnitRetryAttempt } from '../types/junit.js'
import { readJUnitReportsFromGlob } from './read.js'
import path from 'path'

/**
 * Options for the conversion
 */
export interface ConvertOptions {
  outputPath?: string
  toolName?: string
  envProps?: string[]
  useSuiteName?: boolean
  log?: boolean
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
): Promise<Report | null> {
  const { outputPath, toolName, envProps, useSuiteName } = options
  const testCases = await readJUnitReportsFromGlob(pattern, {
    log: options.log,
  })
  const envPropsObj = envProps
    ? Object.fromEntries(envProps.map(prop => prop.split('=')))
    : {}

  if (testCases.length === 0) {
    console.warn(
      'No test cases found in the provided path. No CTRF report generated.'
    )
    return null
  }

  if (options.log)
    console.log(`Converting ${testCases.length} test cases to CTRF format`)
  const ctrfReport = createCTRFReport(
    testCases,
    toolName,
    envPropsObj,
    useSuiteName
  )

  if (outputPath) {
    const finalOutputPath = path.resolve(outputPath)
    const outputDir = path.dirname(finalOutputPath)
    await fs.ensureDir(outputDir)

    if (options.log) console.log('Writing CTRF report to:', finalOutputPath)

    const jsonString = serializeCTRFReport(ctrfReport)
    await fs.writeFile(finalOutputPath, jsonString, 'utf-8')

    if (options.log) console.log(`CTRF report written to ${outputPath}`)
  }
  return ctrfReport
}

/**
 * Safely serialize a CTRF report to JSON with detailed error diagnostics
 * @param report - The CTRF report to serialize
 * @returns JSON string representation of the report
 * @throws Error with detailed diagnostics if serialization fails
 */
function serializeCTRFReport(report: Report): string {
  try {
    return JSON.stringify(report, null, 2)
  } catch (error) {
    console.error('Failed to serialize CTRF report to JSON:')
    console.error(error instanceof Error ? error.message : String(error))

    try {
      JSON.stringify(report.results.summary)
      console.log('Summary serialization: OK')
    } catch {
      console.error('Summary contains invalid data')
    }

    try {
      JSON.stringify(report.results.tool)
      console.log('Tool serialization: OK')
    } catch {
      console.error('Tool contains invalid data')
    }

    try {
      JSON.stringify(report.results.environment)
      console.log('Environment serialization: OK')
    } catch {
      console.error('Environment contains invalid data')
    }

    for (let i = 0; i < report.results.tests.length; i++) {
      try {
        JSON.stringify(report.results.tests[i])
      } catch {
        console.error(
          `Test at index ${i} contains invalid data:`,
          report.results.tests[i].name
        )
      }
    }

    throw error
  }
}

/**
 * Sanitize a string to ensure it's valid for JSON serialization
 * Removes or escapes problematic characters that could break JSON parsing
 * @param str - String to sanitize
 * @returns Sanitized string safe for JSON
 */
export function sanitizeString(str?: string): string | undefined {
  if (str == null) return undefined

  let s = str
  // Remove BOM if present
  s = s.replace(/\uFEFF/g, '')
  // Replace control chars except \n, \r, \t and remove DEL
  // eslint-disable-next-line no-control-regex
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
  // Replace isolated surrogate halves with replacement char
  s = s.replace(/[\uD800-\uDFFF]/g, '�')
  // Normalize Unicode to NFC
  try {
    s = s.normalize('NFC')
  } catch {
    // Ignore if normalization fails
  }

  if (/^\s*$/.test(s)) return undefined

  return s
}

/**
 * Convert JUnit output string to CTRF stdout/stderr array
 * Splits on newlines, sanitizes each line, and filters out empty lines for cleaner output
 * @param output - Raw output string from JUnit
 * @returns Array of non-empty sanitized output lines
 */
function convertOutputToArray(
  output: string | undefined
): string[] | undefined {
  if (!output || output.trim() === '') {
    return undefined
  }

  return output
    .split('\n')
    .map(line => sanitizeString(line.trim()))
    .filter(line => line && line.length > 0) as string[]
}

/**
 * Convert JUnit retry attempts to CTRF retry attempts
 * @param retryAttempts - Array of JUnit retry attempts
 * @param startAttempt - Starting attempt number
 * @returns Array of CTRF RetryAttempt objects
 */
function convertRetryAttempts(
  retryAttempts: JUnitRetryAttempt[],
  startAttempt: number
): RetryAttempt[] {
  return retryAttempts.map((attempt, index) => {
    const retryAttempt: RetryAttempt = {
      attempt: startAttempt + index,
      status: 'failed' as const,
      message: sanitizeString(attempt.message),
      trace: sanitizeString(attempt.trace),
    }

    const stdout = convertOutputToArray(attempt.systemOut)
    const stderr = convertOutputToArray(attempt.systemErr)

    if (stdout) {
      retryAttempt.stdout = stdout
    }
    if (stderr) {
      retryAttempt.stderr = stderr
    }

    return retryAttempt
  })
}

/**
 * Process a JUnit test case and extract retry information to determine final test status
 * @param testCase - JUnit test case with potential retry information
 * @returns Object containing test information including retry details and final status
 */
function processTestWithRetries(testCase: JUnitTestCase): {
  retryAttempts: RetryAttempt[]
  retryCount: number
  finalStatus: Test['status']
  isFlaky: boolean
} {
  const retryAttempts: RetryAttempt[] = []
  let attemptNumber = 1

  if (testCase.flakyFailures && testCase.flakyFailures.length > 0) {
    retryAttempts.push(
      ...convertRetryAttempts(testCase.flakyFailures, attemptNumber)
    )
    attemptNumber += testCase.flakyFailures.length
  }

  if (testCase.flakyErrors && testCase.flakyErrors.length > 0) {
    retryAttempts.push(
      ...convertRetryAttempts(testCase.flakyErrors, attemptNumber)
    )
    attemptNumber += testCase.flakyErrors.length
  }

  const hasFlaky =
    (testCase.flakyFailures && testCase.flakyFailures.length > 0) ||
    (testCase.flakyErrors && testCase.flakyErrors.length > 0)

  if (!hasFlaky) {
    attemptNumber = 2
  }

  if (testCase.rerunFailures && testCase.rerunFailures.length > 0) {
    retryAttempts.push(
      ...convertRetryAttempts(testCase.rerunFailures, attemptNumber)
    )
    attemptNumber += testCase.rerunFailures.length
  }

  if (testCase.rerunErrors && testCase.rerunErrors.length > 0) {
    retryAttempts.push(
      ...convertRetryAttempts(testCase.rerunErrors, attemptNumber)
    )
    attemptNumber += testCase.rerunErrors.length
  }

  const hasRerun =
    (testCase.rerunFailures && testCase.rerunFailures.length > 0) ||
    (testCase.rerunErrors && testCase.rerunErrors.length > 0)

  let finalStatus: Test['status']

  if (hasFlaky) {
    finalStatus = 'passed'
  } else if (hasRerun) {
    if (testCase.hasError) {
      finalStatus = 'failed'
    } else if (testCase.hasFailure) {
      finalStatus = 'failed'
    } else {
      finalStatus = 'failed'
    }
  } else {
    if (testCase.hasFailure || testCase.hasError) {
      finalStatus = 'failed'
    } else if (testCase.skipped) {
      finalStatus = 'skipped'
    } else {
      finalStatus = 'passed'
    }
  }

  return {
    retryAttempts,
    retryCount: retryAttempts.length,
    finalStatus,
    isFlaky: !!hasFlaky,
  }
}

function convertToCTRFTest(
  testCase: JUnitTestCase,
  useSuiteName: boolean
): Test {
  const testInfo = processTestWithRetries(testCase)

  const durationMs = Math.round(parseFloat(testCase.time || '0') * 1000)

  const testName = useSuiteName
    ? `${sanitizeString(testCase.suite)}: ${sanitizeString(testCase.name)}`
    : sanitizeString(testCase.name)

  const line = testCase.lineno ? parseInt(testCase.lineno) : undefined

  const test: Test = {
    name: testName || 'Unnamed Test',
    status: testInfo.finalStatus,
    duration: durationMs,
    filePath: testCase.file,
    line: line,
    message:
      sanitizeString(testCase.failureMessage || testCase.errorMessage) ||
      undefined,
    trace:
      sanitizeString(testCase.failureTrace || testCase.errorTrace) || undefined,
    suite: sanitizeString(testCase.suite),
  }

  if (testInfo.retryCount > 0) {
    test.retries = testInfo.retryCount
    test.retryAttempts = testInfo.retryAttempts
  }

  if (testInfo.isFlaky) {
    test.flaky = true
  }

  const stdout = convertOutputToArray(testCase.systemOut)
  const stderr = convertOutputToArray(testCase.systemErr)

  if (stdout) {
    test.stdout = stdout
  }
  if (stderr) {
    test.stderr = stderr
  }

  return test
}

export function createCTRFReport(
  testCases: JUnitTestCase[],
  toolName?: string,
  envProps?: Record<string, string>,
  useSuiteName?: boolean
): Report {
  const ctrfTests = testCases.map(testCase =>
    convertToCTRFTest(testCase, !!useSuiteName)
  )
  const passed = ctrfTests.filter(test => test.status === 'passed').length
  const failed = ctrfTests.filter(test => test.status === 'failed').length
  const skipped = ctrfTests.filter(test => test.status === 'skipped').length
  const pending = ctrfTests.filter(test => test.status === 'pending').length
  const other = ctrfTests.filter(test => test.status === 'other').length
  const flaky = ctrfTests.filter(test => test.flaky === true).length

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
  }

  const tool: Tool = {
    name: toolName || 'junit-to-ctrf',
  }

  const report: Report = {
    reportFormat: 'CTRF',
    specVersion: '0.0.0',
    generatedBy: 'junit-to-ctrf',
    timestamp: new Date().toISOString(),
    results: {
      tool,
      summary,
      tests: ctrfTests,
    },
  }

  if (envProps && Object.keys(envProps).length > 0) {
    report.results.environment = envProps
  }

  return report
}
