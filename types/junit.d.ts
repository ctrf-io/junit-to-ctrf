export interface JUnitRetryAttempt {
  message?: string
  type?: string
  trace?: string
  systemOut?: string
  systemErr?: string
}

export interface JUnitTestCase {
  suite: string
  classname: string
  name: string
  time: string
  hasFailure: boolean
  failureTrace: string | undefined
  failureMessage: string | undefined
  failureType: string | undefined
  hasError: boolean
  errorTrace: string | undefined
  errorMessage: string | undefined
  errorType: string | undefined
  file?: string
  lineno?: string
  skipped?: boolean
  flakyFailures?: JUnitRetryAttempt[]
  flakyErrors?: JUnitRetryAttempt[]
  rerunFailures?: JUnitRetryAttempt[]
  rerunErrors?: JUnitRetryAttempt[]
  systemOut?: string
  systemErr?: string
}
