# Changelog

## 0.1.0

- Emit validated CTRF 0.2.0 reports with logical test, execution, final and prior attempt IDs; support explicit run/shard options.
- Correct Surefire retry ordering and final diagnostics. Emit numeric build numbers and place custom environment fields under `extra`.
- Refresh dependencies and build tooling.


## 0.0.11

- sanitize strings in JUnit report more thoroughly to avoid invalid characters in CTRF report

## 0.0.10

- Add support for maven surefire retries rerunFailingTestsCount
