import { describe, it, expect } from 'vitest'
import { createCTRFReport } from './convert.js'
import type { JUnitTestCase } from '../types/junit.js'

describe('createCTRFReport with surefire retry functionality', () => {
  it('should handle flaky tests that eventually pass', () => {
    const testCases: JUnitTestCase[] = [
      {
        suite: 'com.example.MyTest',
        classname: 'com.example.MyTest',
        name: 'testFlakyFeature',
        time: '3.456',
        hasFailure: false,
        failureTrace: undefined,
        failureMessage: undefined,
        failureType: undefined,
        hasError: false,
        errorTrace: undefined,
        errorMessage: undefined,
        errorType: undefined,
        skipped: false,
        flakyFailures: [
          {
            message: 'Run 1 failed: expected true but was false',
            type: 'java.lang.AssertionError',
            trace:
              'java.lang.AssertionError: expected true but was false\\n\\tat com.example.MyTest.testFlakyFeature(MyTest.java:42)',
            systemOut: 'Run 1 output: Starting testFlakyFeature...',
            systemErr: 'Run 1 error: java.lang.AssertionError at line 42',
          },
          {
            message: 'Run 2 failed: expected true but was false',
            type: 'java.lang.AssertionError',
            trace:
              'java.lang.AssertionError: expected true but was false\\n\\tat com.example.MyTest.testFlakyFeature(MyTest.java:42)',
            systemOut: 'Run 2 output: Retrying testFlakyFeature...',
            systemErr: 'Run 2 error: java.lang.AssertionError at line 42',
          },
        ],
        systemOut:
          'Run 3 output: Retrying testFlakyFeature...\\nTest passed successfully.',
        systemErr: '',
      },
    ]

    const report = createCTRFReport(testCases)

    expect(report.results.summary.tests).toBe(1)
    expect(report.results.summary.passed).toBe(1)
    expect(report.results.summary.failed).toBe(0)
    expect(report.results.summary.flaky).toBe(1)

    const test = report.results.tests[0]
    expect(test.status).toBe('passed')
    expect(test.flaky).toBe(true)
    expect(test.retries).toBe(2)
    expect(test.retryAttempts).toHaveLength(2)
    expect(test.retryAttempts?.[0].attempt).toBe(1)
    expect(test.retryAttempts?.[0].status).toBe('failed')
    expect(test.retryAttempts?.[0].message).toBe(
      'Run 1 failed: expected true but was false'
    )
    expect(test.retryAttempts?.[0].stdout).toEqual([
      'Run 1 output: Starting testFlakyFeature...',
    ])
    expect(test.retryAttempts?.[0].stderr).toEqual([
      'Run 1 error: java.lang.AssertionError at line 42',
    ])
    expect(test.retryAttempts?.[1].attempt).toBe(2)
    expect(test.retryAttempts?.[1].status).toBe('failed')
    expect(test.retryAttempts?.[1].message).toBe(
      'Run 2 failed: expected true but was false'
    )
    expect(test.retryAttempts?.[1].stdout).toEqual([
      'Run 2 output: Retrying testFlakyFeature...',
    ])
    expect(test.retryAttempts?.[1].stderr).toEqual([
      'Run 2 error: java.lang.AssertionError at line 42',
    ])
  })

  it('should handle tests that fail in all retry attempts', () => {
    const testCases: JUnitTestCase[] = [
      {
        suite: 'com.example.MyTest',
        classname: 'com.example.MyTest',
        name: 'testFlakyFeature',
        time: '0.123',
        hasFailure: true,
        failureTrace:
          'java.lang.AssertionError: expected true but was false\\n\\tat com.example.MyTest.testFlakyFeature(MyTest.java:42)',
        failureMessage: 'expected true but was false',
        failureType: 'java.lang.AssertionError',
        hasError: false,
        errorTrace: undefined,
        errorMessage: undefined,
        errorType: undefined,
        skipped: false,
        rerunFailures: [
          {
            message: 'expected true but was false',
            type: 'java.lang.AssertionError',
            trace:
              'java.lang.AssertionError: expected true but was false\\n\\tat com.example.MyTest.testFlakyFeature(MyTest.java:42)',
            systemOut: 'Run 2 output: Retrying testFlakyFeature...',
            systemErr: 'Run 2 error: java.lang.AssertionError at line 42',
          },
        ],
        rerunErrors: [
          {
            message: 'NullPointerException occurred',
            type: 'java.lang.NullPointerException',
            trace:
              'java.lang.NullPointerException\\n\\tat com.example.MyTest.testFlakyFeature(MyTest.java:45)',
            systemOut: 'Run 3 output: Retrying testFlakyFeature...',
            systemErr: 'Run 3 error: java.lang.NullPointerException at line 45',
          },
        ],
        systemOut: 'Run 1 output: Starting testFlakyFeature...',
        systemErr: 'Run 1 error: java.lang.AssertionError at line 42',
      },
    ]

    const report = createCTRFReport(testCases)

    expect(report.results.summary.tests).toBe(1)
    expect(report.results.summary.passed).toBe(0)
    expect(report.results.summary.failed).toBe(1)
    expect(report.results.summary.flaky).toBeUndefined()

    const test = report.results.tests[0]
    expect(test.status).toBe('failed')
    expect(test.flaky).toBeUndefined()
    expect(test.retries).toBe(2)
    expect(test.retryAttempts).toHaveLength(2)
    expect(test.retryAttempts?.[0].attempt).toBe(2)
    expect(test.retryAttempts?.[0].status).toBe('failed')
    expect(test.retryAttempts?.[0].message).toBe('expected true but was false')
    expect(test.retryAttempts?.[0].stdout).toEqual([
      'Run 2 output: Retrying testFlakyFeature...',
    ])
    expect(test.retryAttempts?.[0].stderr).toEqual([
      'Run 2 error: java.lang.AssertionError at line 42',
    ])
    expect(test.retryAttempts?.[1].attempt).toBe(3)
    expect(test.retryAttempts?.[1].status).toBe('failed')
    expect(test.retryAttempts?.[1].message).toBe(
      'NullPointerException occurred'
    )
    expect(test.retryAttempts?.[1].stdout).toEqual([
      'Run 3 output: Retrying testFlakyFeature...',
    ])
    expect(test.retryAttempts?.[1].stderr).toEqual([
      'Run 3 error: java.lang.NullPointerException at line 45',
    ])
  })

  it('should handle regular tests without retries', () => {
    const testCases: JUnitTestCase[] = [
      {
        suite: 'com.example.MyTest',
        classname: 'com.example.MyTest',
        name: 'testRegularFeature',
        time: '0.150',
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
    ]

    const report = createCTRFReport(testCases)

    expect(report.results.summary.tests).toBe(1)
    expect(report.results.summary.passed).toBe(1)
    expect(report.results.summary.failed).toBe(0)
    expect(report.results.summary.flaky).toBeUndefined()

    const test = report.results.tests[0]
    expect(test.status).toBe('passed')
    expect(test.flaky).toBeUndefined()
    expect(test.retries).toBeUndefined()
    expect(test.retryAttempts).toBeUndefined()
  })

  it('should handle empty and whitespace-only output gracefully', () => {
    const testCases: JUnitTestCase[] = [
      {
        suite: 'com.example.MyTest',
        classname: 'com.example.MyTest',
        name: 'testWithEmptyOutput',
        time: '0.100',
        hasFailure: false,
        failureTrace: undefined,
        failureMessage: undefined,
        failureType: undefined,
        hasError: false,
        errorTrace: undefined,
        errorMessage: undefined,
        errorType: undefined,
        skipped: false,
        systemOut: '   \n\n   \n   ',
        systemErr: '',
      },
    ]

    const report = createCTRFReport(testCases)
    const test = report.results.tests[0]

    expect(test.stdout).toBeUndefined()
    expect(test.stderr).toBeUndefined()
  })
})
