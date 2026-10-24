import { runExpectedFailure } from "./shared/expected-failures.mjs";
import { checkEntry, catalogue, valuesAt } from "./shared/checks.mjs";
const traceFamily = "conformance/property/results.tests[].trace";
const missingTrace =
	"mocha fixture failure\nError: mocha fixture failure\n    at Context.<anonymous> (mocha/cases.cjs:6:9)\n    at process.processImmediate (node:internal/timers:574:21)";
const traceFixtureSha =
	"ee6b90fd9f78018e84d597a2d4ac83cf2deac8fb917f96077226a36465debef9";
const family = "conformance/report/respects-reserved-extension-ownership";
export const expectedFailures = {
	[traceFamily]: {
		issue: "junit-plain-text-failure-trace",
		reason:
			"Plain-text Mocha xUnit failure bodies are dropped instead of preserved as the trace",
		followUp: "https://github.com/ctrf-io/junit-to-ctrf/issues/81",
		samples: {
			unit: ["authentic-mocha-xunit"],
			integration: ["authentic-mocha-xunit"],
		},
	},
	[family]: {
		issue: "junit-reserved-environment-extensions",
		reason:
			"Custom environment properties are emitted with reserved CTRF extension prefixes",
		followUp: "https://github.com/ctrf-io/junit-to-ctrf/issues/80",
		samples: {
			unit: ["reserved-dot", "reserved-slash"],
			integration: ["reserved-dot", "reserved-slash"],
		},
	},
};
export function expectedFailure(entry, level) {
	const issue = expectedFailures[entry.id];
	return issue?.samples[level] ? issue : undefined;
}
export function matchesKnownFailure(entry, sample, issue, error) {
	if (entry.id === traceFamily) {
		return (
			issue.issue === expectedFailures[traceFamily].issue &&
			sample.name === "authentic-mocha-xunit" &&
			sample.native?.fixture?.sha256 === traceFixtureSha &&
			sample.native.cases[1]?.trace === missingTrace &&
			sample.report.results.tests.length === 4 &&
			sample.report.results.tests[1].name === "failure" &&
			sample.report.results.tests[1].status === "failed" &&
			valuesAt(sample.report, entry.path).length === 0 &&
			error.code === "ERR_ASSERTION" &&
			error.operator === "deepStrictEqual" &&
			JSON.stringify(error.actual) === "[]" &&
			JSON.stringify(error.expected) === JSON.stringify([missingTrace]) &&
			error.message.split("\n")[0] ===
				`${sample.name}: source mapping ${entry.path}`
		);
	}

	const key = {
		"reserved-dot": "ctrf.fixture",
		"reserved-slash": "ctrf/fixture",
	}[sample.name];
	if (
		entry.id !== family ||
		issue.issue !== expectedFailures[family].issue ||
		!key
	)
		return false;
	const reserved = catalogue.entries
		.filter(
			(item) =>
				item.kind === "property" &&
				(item.path === "extra" || item.path.endsWith(".extra")),
		)
		.flatMap((item) =>
			valuesAt(sample.report, item.path).flatMap((extra) =>
				Object.entries(extra)
					.filter(
						([name]) => name.startsWith("ctrf.") || name.startsWith("ctrf/"),
					)
					.map(([name, value]) => [item.path, name, value]),
			),
		);
	return (
		error.code === "ERR_ASSERTION" &&
		error.operator === "==" &&
		error.actual === undefined &&
		error.expected === true &&
		error.message ===
			`${sample.name}: fixture producer claimed reserved extension ${key}` &&
		JSON.stringify(reserved) ===
			JSON.stringify([["results.environment.extra", key, "third-party"]]) &&
		JSON.stringify(sample.native?.options?.envProps) ===
			JSON.stringify([`${key}=third-party`])
	);
}
export function runConformance(entry, context, level) {
	return runExpectedFailure(
		entry,
		context,
		level,
		expectedFailure(entry, level),
		checkEntry,
		matchesKnownFailure,
	);
}
