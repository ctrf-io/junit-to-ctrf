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