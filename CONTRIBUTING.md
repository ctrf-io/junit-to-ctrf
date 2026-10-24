# Contributing

First off, thank you for considering contributing to this project.

## Reporting Issues

Before submitting an issue, please check the issue tracker to ensure that the issue hasn't already been reported. If you find your issue already reported, you can subscribe to that issue to receive updates. If you have any additional information to add, please comment on the issue. If the issue is unnasigned and you'd like to contribute, assign the issue to yourself.

## How to Contribute

If you'd like to contribute, start by searching through the issues and pull requests to see whether someone else has raised a similar idea or question.

If you don't see your idea listed, and you think it fits into the goals of this project, do one of the following:

- If your contribution is minor, such as a typo fix, open a pull request.
- If your contribution is major, or you have not yet decided how to implement your idea, open an issue to discuss it. This allows other contributors to point out any potential flaws or to help you flesh out your idea.

### Pull Requests

1. Fork the repository and create your branch from `main`.
2. Write some code
3. Make sure your code lints.
4. Issue that pull request!

### Commit Messages

Write meaningful commit messages that provide insight into the changes made.

## Finding Bugs

If you find a bug, please report it in the issue tracker with a detailed description.

## Feature Requests

Feature requests are welcome. But take a moment to find out whether your idea fits with the scope and aims of the project. Please provide as much detail and context as possible.

## License

By contributing to this project, you agree that your contributions will be licensed under MIT.

## Acknowledgments

Your contributions are sincerely appreciated. We want to make contributing to this project as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features

Thank you for your interest in contributing


## TypeScript toolchain

The `tsc` command uses native TypeScript 7.0.2 through the exact
`@typescript/native` npm alias. The `typescript` dependency aliases
`@typescript/typescript6@6.0.2` to retain the compiler API needed by build and
documentation tools; `tsc6` is available for compatibility checks. Keep these
aliases separate when updating dependencies. Both are development dependencies
and do not change the package’s production Node requirement.

See [Microsoft’s side-by-side setup](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6.0).

### Conformance tests

For reporter output changes, update the affected conformance fixtures and run:

```bash
npm run test:standard:conformance:unit
npm run test:standard:conformance:integration
```

`npm run test:standard:conformance` runs both levels even when unit fails.
The [suite guide](tests/standard/conformance/README.md) explains setup and file roles.
Unit tests use controlled native inputs; integration tests install the packed
converter and exercise its real API and CLI against independent XML source
expectations. They remain separate from `npm test` and the original integration smoke.

Keep common family IDs stable, update `junit.json` when capabilities change,
and provide positive evidence for supported properties. Unsupported optional
features are skipped with reasons; unrecorded broken behavior must fail.
Expected-failure entries in `tests/standard/conformance/expected-failures.mjs`
must identify a durable fix follow-up and match specific levels/samples. Keep
checks running;
unexpected passes and changed failures must fail. Remove markers with the fix.
Check schema and written-specification implications, including valid omission and
conditional rules. Recommendations remain advisory. Do not change expectations
to match incorrect reporter output.

CI runs both conformance levels as separate steps in the existing test/build
job on Node 22, 24 and 26. A unit failure does not prevent integration from running.
The job publishes CTRF results for both levels through GitHub Test Reporter, with
the built-in summary and folded suite table, grouped by level and check category.
Node 24 also maintains one PR comment tagged `reporter-conformance`, overwriting it on later runs. It describes
the reference runtime; check the full matrix for compatibility results. Fork PRs
keep build summaries/artifacts without posting a comment. Expected failures retain
explicit test-name labels and use Other with defect metadata rather than passed.
Unit/integration names and identities stay distinct; the conformance comment
contains contract families only. Shared checker controls use the same independent
fixtures and test IDs across reporters, run with `npm run test:standard:checker`,
and publish separately under `reporter-checker`. Reporter-specific fixture,
matcher and reporting controls belong in the reporter's own tests and
`reporter-tests` results. `npm run test:standard` runs all standard suites.
CTRF artifacts, conformance summaries and integration reports/logs are retained,
including on failure. Standard suites use the native Node test runner and the
shared CTRF writer. Ordinary tests use the default and CTRF reporters configured in `vitest.config.ts`; no
additional runner JSON output is required.
In your PR, include commands and results and explain skips, expected failures and
warnings. Track defect details and fixes in GitHub issues rather than these docs.

For XML reader changes, retain coverage from the
[framework-generated corpus](tests/native/junit-fixtures/README.md) alongside
controlled boundary fixtures. Refresh exporter snapshots with
`npm run fixtures:junit:refresh` when assessing new source versions. Preserve raw
XML, record generation provenance, and derive expectations from native/source
results. Review expected-failure markers when snapshots change.
