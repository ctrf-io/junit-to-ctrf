# Standard conformance

Conformance uses shared property and report/relationship checks at both unit and
integration levels, against the declared CTRF specification version. These are
coverage families, not an exhaustive set of cases. Existing reporter tests and
integration smoke are separate.

```sh
npm run test:standard:conformance:unit
npm run test:standard:conformance:integration
# Run both, even if unit fails:
npm run test:standard:conformance
```

Unit tests capture serialized output from controlled JUnit XML inputs; separate
controls test the checker. Integration installs the packed converter in a temporary
consumer and uses its real API and CLI, including nested suites and multi-file
globs. It needs npm registry access. Missing setup fails the run. Source test
execution times are independent of conversion timestamps; this converter currently
emits zero summary endpoints and does not infer unavailable attempt durations.

Stored [framework-generated XML](../../native/junit-fixtures/README.md) also
supplies evidence at both levels. Its guide describes source provenance and refresh.

Temporary consumers are cleaned automatically. Set `CTRF_STANDARD_ARTIFACTS` to an
absolute directory outside the checkout to retain integration reports and logs.

Both suites generate schema-validated CTRF under `$CTRF_STANDARD_ARTIFACTS/reports`
(or `ctrf/reports` locally). CI publishes these through GitHub Test Reporter in the
test/build job summary and retains CTRF artifacts. The reference Node job also
maintains one PR comment using the built-in summary and folded suite table;
no custom template is needed. Fork PRs retain build summaries and artifacts with
read-only tokens. Shared checker controls run and report separately. Expected failures use **Other**,
explicit labels and defect metadata;
they are not counted as passed. Unit and integration identities remain distinct.

- `shared/catalogue.json`: common family IDs for this pilot; property paths are
  checked against the schema. It is a local snapshot pending shared distribution.
- `shared/checks.mjs`: schema and specification assertions.
- `shared/expected-failures.mjs`: common strict expected-failure engine.
- `junit.json`: capabilities and reasons for unsupported entries.
- `tests/native/fixtures.mjs` and native fixtures: independent JUnit expectations.

Unsupported optional features remain skipped with reasons. Supported fields need
positive evidence; all emitted fields undergo full-document validation. Mandatory
violations fail, recommendations warn, and missing fixture evidence cannot count
as a pass. Expected-failure entries in `expected-failures.mjs` identify fix follow-ups
and match specific samples. They still execute and
are reported separately as expected failures; different errors or unexpected
passes fail CI. Remove the matching markers when fixing a defect. Expected
failures are not conformance passes.
The conformance comment contains only contract families, grouped by unit/integration
and schema properties/specification relationships. Expected failures have separate
tracked-defect groups. The top summary distinguishes skipped, failed and Other;
the built-in folded table combines skipped/pending/Other in its Other column.
Expected-failure groups contain only tracked defects, never unsupported skips.

`npm run test:standard:checker` runs the independent shared checker controls in
`tests/standard/checker`. These have the same IDs and implementation for every
reporter adopting this revision and publish to a separate `reporter-checker`
comment. Their CTRF is under `$CTRF_STANDARD_ARTIFACTS/checker-reports` (or
`ctrf/checker-reports` locally), outside the conformance report glob.
`npm run test:standard` runs shared controls and both conformance levels even if
one fails. Reporter-specific fixture, matcher and reporting-adapter controls live
in the reporter's own tests and appear in the `reporter-tests` comment.
The standard harness is excluded from the published package.
