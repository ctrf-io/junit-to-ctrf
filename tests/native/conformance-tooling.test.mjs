import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, it } from "vitest";
import { convertJUnitToCTRFReport } from "../../src/index.ts";
import { unitContext } from "../standard/conformance/unit/fixtures.mjs";
import {
	catalogue,
	disposition,
	valuesAt,
	checkEntry,
} from "../standard/conformance/shared/checks.mjs";
import {
	expectedFailure,
	runConformance,
} from "../standard/conformance/expected-failures.mjs";
import { createReport } from "../standard/conformance/reporters/ctrf.mjs";
import { recordsFromRun } from "../reporters/vitest.mjs";
import { nativeCases, xml } from "./fixtures.mjs";
let context;
beforeAll(async () => {
	context = await unitContext({ convertJUnitToCTRFReport });
});
const entry = catalogue.entries.find(
	(item) => item.rule === "respects-reserved-extension-ownership",
);
const clone = () => structuredClone(context);
describe("native conformance tooling", () => {
	it("preserves reviewed shared source hashes", () => {
		const manifest = JSON.parse(
			readFileSync(new URL("../standard/shared-files.json", import.meta.url)),
		);
		assert.equal(manifest.revision, "standard-checker-controls-v1");
		for (const [file, hash] of Object.entries(manifest.files))
			assert.equal(
				createHash("sha256")
					.update(readFileSync(new URL(`../standard/${file}`, import.meta.url)))
					.digest("hex"),
				hash,
				file,
			);
	});
	it("declares exactly the common inventory without hiding emitted fields", () => {
		const manifest = JSON.parse(
			readFileSync(
				new URL("../standard/conformance/junit.json", import.meta.url),
			),
		);
		assert.deepEqual(
			Object.keys(manifest.properties).sort(),
			catalogue.entries
				.filter((item) => item.kind === "property")
				.map((item) => item.path)
				.sort(),
		);
		assert.deepEqual(
			Object.keys(manifest.rules).sort(),
			catalogue.entries
				.filter((item) => item.kind !== "property")
				.map((item) => item.rule)
				.sort(),
		);
		for (const item of catalogue.entries)
			if (item.kind === "property" && !disposition(item, manifest).supported)
				for (const sample of context.samples)
					assert.equal(valuesAt(sample.report, item.path).length, 0, item.id);
	});
	it("checks independent test inventory, omission and final diagnostics", () => {
		for (const sample of context.samples.filter(
			(item) => !item.native.authentic,
		)) {
			assert.equal(
				sample.report.results.tests.length,
				sample.native.cases.length,
			);
			assert.deepEqual(
				sample.report.results.environment,
				sample.expected.results.environment,
			);
			for (const [index, source] of sample.native.cases.entries()) {
				const actual = sample.report.results.tests[index];
				const wanted = sample.expected.results.tests[index];
				for (const key of [
					"filePath",
					"line",
					"stdout",
					"stderr",
					"message",
					"trace",
					"suite",
					"retries",
					"flaky",
				])
					assert.deepEqual(actual[key], wanted[key], `${sample.name}: ${key}`);
				if (!source.history) assert.equal(actual.retryAttempts, undefined);
				else
					for (const [attempt, earlier] of actual.retryAttempts.entries())
						for (const key of ["message", "trace", "stdout", "stderr"])
							assert.deepEqual(
								earlier[key],
								wanted.retryAttempts[attempt][key],
							);
			}
			if (!sample.native.options.runId)
				assert.equal(Object.hasOwn(sample.report, "runId"), false);
		}
	});
	it("retains authentic source provenance and native inventories", () => {
		const samples = context.samples.filter((sample) => sample.native.authentic);
		assert.deepEqual(
			samples.map((sample) => sample.native.fixture.id),
			["playwright", "vitest", "mocha-xunit", "go"],
		);
		for (const sample of samples) {
			assert.equal(sample.native.fixture.sourceExit, 1);
			assert.ok(sample.native.fixture.framework);
			assert.equal(
				sample.native.fixture.native.length,
				sample.native.cases.length,
			);
		}
	});
	it("converts authentic outcomes without inventing unavailable retry metadata", () => {
		for (const sample of context.samples.filter(
			(item) => item.native.authentic,
		)) {
			assert.deepEqual(
				sample.report.results.tests.map((test) => [
					test.name,
					test.status,
					test.duration,
					test.suite,
				]),
				sample.expected.results.tests.map((test) => [
					test.name,
					test.status,
					test.duration,
					test.suite,
				]),
			);
			for (const test of sample.report.results.tests) {
				assert.equal(test.retries, undefined);
				assert.equal(test.retryAttempts, undefined);
				assert.equal(test.flaky, undefined);
			}
		}
	});

	it("preserves authentic plain-text traces at both conformance levels", () => {
		const traceEntry = catalogue.entries.find(
			(item) => item.path === "results.tests[].trace",
		);
		for (const level of ["unit", "integration"]) {
			assert.equal(expectedFailure(traceEntry, level), undefined);
			assert.equal(runConformance(traceEntry, context, level), undefined);
		}
	});
	it("rejects missing or changed authentic trace mappings", () => {
		const traceEntry = catalogue.entries.find(
			(item) => item.path === "results.tests[].trace",
		);
		for (const value of [undefined, "different trace"]) {
			const changed = clone();
			const test = changed.samples.find(
				(item) => item.name === "authentic-mocha-xunit",
			).report.results.tests[1];
			if (value === undefined) delete test.trace;
			else test.trace = value;
			assert.throws(
				() => runConformance(traceEntry, changed, "unit"),
				/source mapping/u,
			);
		}
	});

	it("distinguishes duplicate names, display prefixes and custom identities", () => {
		const full = context.samples.find((sample) => sample.name === "full").report
			.results.tests;
		assert.notEqual(full[0].testId, full.at(-1).testId);
		assert.deepEqual(
			full.map((test) => test.testId),
			context.samples
				.find((sample) => sample.name === "prefixed")
				.report.results.tests.map((test) => test.testId),
		);
		for (const test of context.samples.find(
			(sample) => sample.name === "custom-identity",
		).report.results.tests)
			assert.match(test.testId, /^source:/u);
	});
	it("keeps source execution timing distinct from document generation", () => {
		for (const sample of context.samples) {
			assert.equal(sample.report.results.summary.start, 0);
			assert.equal(sample.report.results.summary.stop, 0);
			assert.ok(Number.isFinite(Date.parse(sample.report.timestamp)));
			// Retry duration is absent in this converter's history, not fabricated.
			for (const test of sample.report.results.tests)
				for (const attempt of test.retryAttempts ?? [])
					assert.equal(attempt.duration, undefined);
		}
	});
	it("checks extension ownership without expected failures", () => {
		for (const level of ["unit", "integration"]) {
			assert.equal(expectedFailure(entry, level), undefined);
			assert.equal(runConformance(entry, context, level), undefined);
		}
		for (const key of ["ctrf.fixture", "ctrf/fixture"]) {
			const changed = clone();
			changed.samples[0].report.results.environment.extra = {
				[key]: "third-party",
			};
			assert.throws(
				() => runConformance(entry, changed, "unit"),
				/claimed reserved extension/u,
			);
		}
	});
	it("retired exception labels stay ordinary reporter results", () => {
		const report = createReport(
			[
				{
					name: `${entry.id} [expected failure: junit-reserved-environment-extensions]`,
					status: "passed",
				},
			],
			"unit",
			"native-control",
			0,
			1,
		);
		assert.equal(report.results.summary.other, 0);
		assert.equal(report.results.summary.passed, 1);
		assert.equal(report.results.tests[0].extra?.expectedFailure, undefined);
	});

	it("keeps unexpected failure, skipped and pending results distinct", () => {
		const report = createReport(
			["failed", "skipped", "pending"].map((status) => ({
				name: entry.id,
				status,
			})),
			"integration",
			"native-control",
			0,
			1,
		);
		assert.deepEqual(
			report.results.tests.map((test) => test.status),
			["failed", "skipped", "pending"],
		);
		assert.equal(report.results.extra.expectedFailures, 0);
	});
	it("does not drop collection errors or unhandled runner errors", () => {
		const records = recordsFromRun(
			[
				{
					moduleId: "broken",
					children: { allTests: () => [] },
					errors: () => [new Error("collection")],
				},
			],
			[new Error("unhandled")],
		);
		assert.deepEqual(
			records.map((record) => record.status),
			["failed", "failed"],
		);
	});
	it("rejects corruptions of serialized real producer output", () => {
		const full = context.samples.find((sample) => sample.name === "full");
		for (const mutate of [
			(report) => {
				report.results.tests[0].duration = "invalid";
			},
			(report) => {
				report.reportFormat = "invalid";
			},
			(report) => {
				report.results.tests[0].suite = "invalid";
			},
		]) {
			const report = structuredClone(full.report);
			mutate(report);
			assert.throws(() =>
				checkEntry(
					catalogue.entries.find((item) => item.rule === "single-json-object"),
					{
						samples: [
							{
								report,
								bytes: Buffer.from(JSON.stringify(report)),
								name: "corrupted",
							},
						],
					},
				),
			);
		}
	});
	it.each(["", "1.5", "invalid"])(
		"rejects invalid configured build number %s without writing output",
		async (value) => {
			const scratch = await mkdtemp(path.join(tmpdir(), "ctrf-junit-invalid-"));
			try {
				const input = path.join(scratch, "input.xml"),
					outputPath = path.join(scratch, "report.json");
				await writeFile(input, xml(nativeCases()));
				await assert.rejects(
					convertJUnitToCTRFReport(input, {
						outputPath,
						envProps: [`buildNumber=${value}`],
					}),
					/buildNumber must be an integer/u,
				);
				assert.equal(existsSync(outputPath), false);
			} finally {
				await rm(scratch, { recursive: true, force: true });
			}
		},
	);
	it.each(["runId", "shardId"])(
		"rejects empty %s without writing output",
		async (key) => {
			const scratch = await mkdtemp(path.join(tmpdir(), "ctrf-junit-invalid-"));
			try {
				const input = path.join(scratch, "input.xml"),
					outputPath = path.join(scratch, "report.json");
				await writeFile(input, xml(nativeCases()));
				await assert.rejects(
					convertJUnitToCTRFReport(input, { outputPath, [key]: "" }),
					/must be a non-empty string/u,
				);
				assert.equal(existsSync(outputPath), false);
			} finally {
				await rm(scratch, { recursive: true, force: true });
			}
		},
	);
	it("does not invent an empty conversion document", async () => {
		const scratch = await mkdtemp(path.join(tmpdir(), "ctrf-junit-empty-"));
		try {
			const input = path.join(scratch, "empty.xml"),
				outputPath = path.join(scratch, "output.json");
			await writeFile(input, '<testsuite name="empty"/>');
			assert.equal(await convertJUnitToCTRFReport(input, { outputPath }), null);
			assert.equal(existsSync(outputPath), false);
		} finally {
			await rm(scratch, { recursive: true, force: true });
		}
	});
});
