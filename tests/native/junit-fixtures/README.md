# Framework-generated JUnit fixtures

These XML files are raw outputs from real test runs. They are copied without
rewriting timestamps, durations, paths or diagnostics. `manifest.json` records
framework/exporter versions, source and XML hashes, native observations and
source expectations. The converter's output is never used to construct them.

Sources live in `../junit-producers/`. Playwright and Vitest use their built-in
JUnit reporters, Mocha uses its built-in xUnit reporter, and Go's real
`go test -json` stream is exported using the pinned go-junit-report tool.
The JavaScript versions and transitive dependencies are locked separately from
the converter. The Playwright suite uses runner-only tests and needs no browser.

```sh
npm run fixtures:junit:refresh
```

Refresh requires Node compatible with the pinned frameworks, npm registry access,
Go and network access for the pinned Go exporter. It runs isolated temporary
consumers and cleans them afterward. Intentional test failures produce exit one;
collection additionally verifies native case inventory, outcomes, retry evidence
and XML timings before copying reports. Missing dependencies or unexpected runs
fail collection. Set `CTRF_JUNIT_ARTIFACTS` to an external absolute directory to
retain native reports and generation logs for inspection.

Review refreshed XML, native observations and source expectations. Reassess any
strict expected-failure record: it is tied to exact source evidence and must not
silently accept a regenerated fixture. Ordinary tests and both conformance levels
replay these snapshots; CI does not install the source frameworks or Go to replay
them. Refresh is a separate compatibility check, not a step on every build.

The built-in exporters used here flatten retries into the final JUnit result.
Their native results prove retries occurred, but these XML files do not carry
Surefire-style structured retry history. Conversion must not invent it. The
controlled synthetic fixtures remain useful for that history and boundary cases.
