import { describe, it, expect } from 'vitest'
import { createCTRFReport, sanitizeString } from './convert.js'
import type { JUnitTestCase } from '../types/junit.js'

describe('createCTRFReport', () => {
  const mockTestCases: JUnitTestCase[] = [
    {
      suite: 'TestSuite1',
      classname: 'TestClass1',
      name: 'testPassed',
      time: '0.5',
      hasFailure: false,
      failureTrace: undefined,
      failureMessage: undefined,
      failureType: undefined,
      hasError: false,
      errorTrace: undefined,
      errorMessage: undefined,
      errorType: undefined,
      file: 'test1.js',
      lineno: '10',
      skipped: false,
    },
    {
      suite: 'TestSuite1',
      classname: 'TestClass1',
      name: 'testFailed',
      time: '1.2',
      hasFailure: true,
      failureTrace: 'Error: Test failed\n    at testFailed (test1.js:15:5)',
      failureMessage: 'Test failed',
      failureType: 'Error',
      hasError: false,
      errorTrace: undefined,
      errorMessage: undefined,
      errorType: undefined,
      file: 'test1.js',
      lineno: '15',
      skipped: false,
    },
    {
      suite: 'TestSuite2',
      classname: 'TestClass2',
      name: 'testSkipped',
      time: '0.1',
      hasFailure: false,
      failureTrace: undefined,
      failureMessage: undefined,
      failureType: undefined,
      hasError: false,
      errorTrace: undefined,
      errorMessage: undefined,
      errorType: undefined,
      file: 'test2.js',
      lineno: '20',
      skipped: true,
    },
  ]

  it('should create a valid CTRF report with basic test cases', () => {
    const report = createCTRFReport(mockTestCases)

    expect(report).toMatchObject({
      reportFormat: 'CTRF',
      specVersion: '0.0.0',
      generatedBy: 'junit-to-ctrf',
      results: {
        tool: {
          name: 'junit-to-ctrf',
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
            name: 'testPassed',
            status: 'passed',
            duration: 500,
            filePath: 'test1.js',
            line: 10,
            suite: 'TestSuite1',
          }),
          expect.objectContaining({
            name: 'testFailed',
            status: 'failed',
            duration: 1200,
            filePath: 'test1.js',
            line: 15,
            message: 'Test failed',
            trace: 'Error: Test failed\n    at testFailed (test1.js:15:5)',
            suite: 'TestSuite1',
          }),
          expect.objectContaining({
            name: 'testSkipped',
            status: 'skipped',
            duration: 100,
            filePath: 'test2.js',
            line: 20,
            suite: 'TestSuite2',
          }),
        ]),
      },
    })

    expect(report.timestamp).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    )
  })

  it('should use custom tool name when provided', () => {
    const report = createCTRFReport(mockTestCases, 'custom-tool')

    expect(report.results.tool).toEqual({
      name: 'custom-tool',
    })
  })

  it('should include environment properties when provided', () => {
    const envProps = {
      nodeVersion: '18.0.0',
      platform: 'darwin',
    }

    const report = createCTRFReport(mockTestCases, undefined, envProps)

    expect(report.results.environment).toEqual(envProps)
  })

  it('should not include environment when not provided', () => {
    const report = createCTRFReport(mockTestCases)

    expect(report.results.environment).toBeUndefined()
  })

  it('should include suite name in test name when useSuiteName is true', () => {
    const report = createCTRFReport(mockTestCases, undefined, undefined, true)

    const tests = report.results.tests
    expect(tests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'TestSuite1: testPassed',
        }),
        expect.objectContaining({
          name: 'TestSuite1: testFailed',
        }),
        expect.objectContaining({
          name: 'TestSuite2: testSkipped',
        }),
      ])
    )
  })

  it('should not include suite name in test name when useSuiteName is false', () => {
    const report = createCTRFReport(mockTestCases, undefined, undefined, false)

    const tests = report.results.tests
    expect(tests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'testPassed',
        }),
        expect.objectContaining({
          name: 'testFailed',
        }),
        expect.objectContaining({
          name: 'testSkipped',
        }),
      ])
    )
  })

  it('should handle test cases with missing optional fields', () => {
    const minimalTestCases: JUnitTestCase[] = [
      {
        suite: 'TestSuite',
        classname: 'TestClass',
        name: 'testMinimal',
        time: '0.3',
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

    const report = createCTRFReport(minimalTestCases)

    expect(report.results.tests).toEqual([
      expect.objectContaining({
        name: 'testMinimal',
        status: 'passed',
        duration: 300,
        filePath: undefined,
        line: undefined,
        message: undefined,
        trace: undefined,
        suite: 'TestSuite',
      }),
    ])
  })

  it('should handle test cases with error instead of failure', () => {
    const errorTestCases: JUnitTestCase[] = [
      {
        suite: 'TestSuite',
        classname: 'TestClass',
        name: 'testWithError',
        time: '0.8',
        hasFailure: false,
        failureTrace: undefined,
        failureMessage: undefined,
        failureType: undefined,
        hasError: true,
        errorTrace:
          'TypeError: Cannot read property of undefined\n    at testWithError (test.js:25:10)',
        errorMessage: 'Cannot read property of undefined',
        errorType: 'TypeError',
        file: 'test.js',
        lineno: '25',
        skipped: false,
      },
    ]

    const report = createCTRFReport(errorTestCases)

    expect(report.results.tests).toEqual([
      expect.objectContaining({
        name: 'testWithError',
        status: 'failed',
        duration: 800,
        filePath: 'test.js',
        line: 25,
        message: 'Cannot read property of undefined',
        trace:
          'TypeError: Cannot read property of undefined\n    at testWithError (test.js:25:10)',
        suite: 'TestSuite',
      }),
    ])
  })

  it('should handle empty test cases array', () => {
    const report = createCTRFReport([])

    expect(report.results.summary).toEqual({
      tests: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      pending: 0,
      other: 0,
      start: 0,
      stop: 0,
    })

    expect(report.results.tests).toEqual([])
  })

  it('should correctly calculate summary statistics', () => {
    const mixedTestCases: JUnitTestCase[] = [
      // Passed test
      {
        suite: 'Suite1',
        classname: 'Class1',
        name: 'test1',
        time: '0.1',
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
        suite: 'Suite1',
        classname: 'Class1',
        name: 'test2',
        time: '0.2',
        hasFailure: true,
        failureTrace: 'Error',
        failureMessage: 'Failed',
        failureType: 'Error',
        hasError: false,
        errorTrace: undefined,
        errorMessage: undefined,
        errorType: undefined,
        skipped: false,
      },
      // Skipped test
      {
        suite: 'Suite1',
        classname: 'Class1',
        name: 'test3',
        time: '0.0',
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
    ]

    const report = createCTRFReport(mixedTestCases)

    expect(report.results.summary).toEqual({
      tests: 3,
      passed: 1,
      failed: 1,
      skipped: 1,
      pending: 0,
      other: 0,
      start: 0,
      stop: 0,
    })
  })
})

describe('sanitizeString', () => {
  describe('null and undefined handling', () => {
    it('should return undefined for undefined input', () => {
      expect(sanitizeString(undefined)).toBeUndefined()
    })

    it('should return undefined for empty string', () => {
      expect(sanitizeString('')).toBeUndefined()
    })

    it('should return undefined for whitespace-only string', () => {
      expect(sanitizeString('   \n\t\r   ')).toBeUndefined()
    })
  })

  describe('normal strings', () => {
    it('should pass through normal ASCII strings unchanged', () => {
      expect(sanitizeString('hello world')).toBe('hello world')
    })

    it('should preserve safe whitespace characters', () => {
      expect(sanitizeString('line1\nline2\tindented\rcarriage')).toBe(
        'line1\nline2\tindented\rcarriage'
      )
    })

    it('should preserve quotes and special characters', () => {
      expect(sanitizeString('He said "hello" & goodbye!')).toBe(
        'He said "hello" & goodbye!'
      )
    })

    it('should preserve Unicode characters (except emojis/surrogates)', () => {
      expect(sanitizeString('café naïve résumé 测试')).toBe(
        'café naïve résumé 测试'
      )
    })

    it('should replace emoji characters (which use surrogates)', () => {
      expect(sanitizeString('hello 🎉 world')).toBe('hello �� world')
    })
  })

  describe('BOM removal', () => {
    it('should remove BOM at start of string', () => {
      expect(sanitizeString('\uFEFFhello world')).toBe('hello world')
    })

    it('should remove BOM in middle of string', () => {
      expect(sanitizeString('hello\uFEFF world')).toBe('hello world')
    })

    it('should remove multiple BOMs', () => {
      expect(sanitizeString('\uFEFFhello\uFEFF world\uFEFF')).toBe(
        'hello world'
      )
    })
  })

  describe('control character replacement', () => {
    it('should replace null bytes with spaces', () => {
      expect(sanitizeString('hello\x00world')).toBe('hello world')
    })

    it('should replace backspace with space', () => {
      expect(sanitizeString('hello\x08world')).toBe('hello world')
    })

    it('should replace bell character with space', () => {
      expect(sanitizeString('hello\x07world')).toBe('hello world')
    })

    it('should replace vertical tab with space', () => {
      expect(sanitizeString('hello\x0Bworld')).toBe('hello world')
    })

    it('should replace form feed with space', () => {
      expect(sanitizeString('hello\x0Cworld')).toBe('hello world')
    })

    it('should replace escape sequences with space', () => {
      expect(sanitizeString('hello\x1Bworld')).toBe('hello world')
    })

    it('should replace DEL character with space', () => {
      expect(sanitizeString('hello\x7Fworld')).toBe('hello world')
    })

    it('should replace unit separator with space', () => {
      expect(sanitizeString('hello\x1Fworld')).toBe('hello world')
    })

    it('should handle multiple control characters', () => {
      expect(sanitizeString('hello\x00\x07\x08\x0B\x0C\x1B\x7Fworld')).toBe(
        'hello       world'
      )
    })
  })

  describe('ANSI escape sequences', () => {
    it('should clean ANSI color codes', () => {
      expect(sanitizeString('\x1B[31mred text\x1B[0m')).toBe(
        ' [31mred text [0m'
      )
    })

    it('should clean complex ANSI sequences', () => {
      expect(
        sanitizeString('\x1B[32mGREEN\x1B[0m normal \x1B[31mRED\x1B[0m')
      ).toBe(' [32mGREEN [0m normal  [31mRED [0m')
    })
  })

  describe('surrogate handling', () => {
    it('should replace isolated high surrogate', () => {
      expect(sanitizeString('hello\uD800world')).toBe('hello�world')
    })

    it('should replace isolated low surrogate', () => {
      expect(sanitizeString('hello\uDFFFworld')).toBe('hello�world')
    })

    it('should handle multiple isolated surrogates', () => {
      // \uD800\uDC00 forms valid char, then both get replaced + \uDFFF gets replaced = 3 replacements
      expect(sanitizeString('test\uD800\uDC00\uDFFFend')).toBe('test���end')
    })
  })

  describe('Unicode normalization', () => {
    it('should normalize composed characters', () => {
      // Composed 'é' vs decomposed 'e' + combining acute
      const composed = 'café'
      const decomposed = 'cafe\u0301'
      expect(sanitizeString(decomposed)).toBe(composed)
    })

    it('should normalize multiple combining characters', () => {
      // Test with combining characters that should normalize
      const input = 'a\u0300\u0301' // a + grave + acute
      const result = sanitizeString(input)
      expect(result).toBeDefined()
      expect(result?.normalize('NFC')).toBe(result)
    })
  })

  describe('complex real-world scenarios', () => {
    it('should handle JUnit error messages with control chars', () => {
      const input = 'Expected 10 but was 9\x00\x08\x1B[31m'
      expect(sanitizeString(input)).toBe('Expected 10 but was 9   [31m')
    })

    it('should handle stack traces with mixed problems', () => {
      const input = '\uFEFFjava.lang.Exception\x00\x0B\x0C\n    at line 42\x07'
      expect(sanitizeString(input)).toBe(
        'java.lang.Exception   \n    at line 42 '
      )
    })

    it('should handle system output with ANSI and control chars', () => {
      const input = '\x1B[32mGREEN\x1B[0m\x00test\x08output'
      expect(sanitizeString(input)).toBe(' [32mGREEN [0m test output')
    })

    it('should handle test names with problematic chars', () => {
      const input = 'testMethod\x1F\x7F\uD800WithProblems'
      expect(sanitizeString(input)).toBe('testMethod  �WithProblems')
    })
  })

  describe('edge cases', () => {
    it('should handle string with only control characters', () => {
      expect(sanitizeString('\x00\x07\x08\x1B')).toBeUndefined()
    })

    it('should handle string with only BOM', () => {
      expect(sanitizeString('\uFEFF')).toBeUndefined()
    })

    it('should handle string with only surrogates', () => {
      // Surrogates get replaced with replacement chars, not removed
      expect(sanitizeString('\uD800\uDFFF')).toBe('��')
    })

    it('should preserve single valid character', () => {
      expect(sanitizeString('a')).toBe('a')
    })

    it('should handle very long strings with scattered problems', () => {
      const input =
        'a'.repeat(1000) +
        '\x00' +
        'b'.repeat(1000) +
        '\x1B[31m' +
        'c'.repeat(1000)
      const result = sanitizeString(input)
      expect(result).toBeDefined()
      // 3000 good chars + 1 space (null) + 6 chars from ANSI sequence (\x1B becomes space, [31m stays)
      expect(result?.length).toBe(3006)
    })
  })

  describe('JSON serialization safety', () => {
    it('should produce strings that can be JSON serialized', () => {
      const problematicInputs = [
        'test\x00with\x07null\x08bytes',
        '\uFEFFBOM\x1B[31mANSI\x0Bvertical\x0Cform',
        'surrogate\uD800\uDFFFpairs',
        '\x00\x01\x02\x03\x04\x05\x06\x07\x08',
        '\x0B\x0C\x0E\x0F\x10\x11\x12\x13\x14\x15\x16\x17\x18\x19\x1A\x1B\x1C\x1D\x1E\x1F\x7F',
      ]

      problematicInputs.forEach(input => {
        const sanitized = sanitizeString(input)
        if (sanitized) {
          expect(() => JSON.stringify({ test: sanitized })).not.toThrow()
        }
      })
    })

    it('should handle real Gradle JUnit output patterns', () => {
      const gradleOutputs = [
        'Test failed: Expected <10> but was: <9>\x00',
        '\x1B[31mFAILED\x1B[0m com.example.Test.method\x07',
        'java.lang.AssertionError\x0B\x0C\n    at Assert.fail(Assert.java:42)',
        '\uFEFFCaused by: java.lang.NullPointerException\x08',
      ]

      gradleOutputs.forEach(output => {
        const sanitized = sanitizeString(output)
        if (sanitized) {
          expect(() => JSON.stringify(sanitized)).not.toThrow()
          expect(() =>
            JSON.parse(JSON.stringify({ msg: sanitized }))
          ).not.toThrow()
        }
      })
    })
  })
})
