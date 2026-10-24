import { runExpectedFailure } from "./shared/expected-failures.mjs";
import { checkEntry, catalogue, valuesAt } from "./shared/checks.mjs";
const family = "conformance/report/respects-reserved-extension-ownership";
export const expectedFailures = {
	[family]: {
		issue: "junit-reserved-environment-extensions",
		reason:
			"Custom environment properties are emitted with reserved CTRF extension prefixes",
		followUp:
			"Reject or namespace reserved environment extension keys; replace this local tracking key with the public fix issue before publication",
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
