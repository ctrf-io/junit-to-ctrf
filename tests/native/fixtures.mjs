// Source data and expected outcomes are defined before the producer is invoked.
export const environment = {
	reportName: "XML fixture ✓",
	appName: "fixture",
	appVersion: "1.2.3",
	buildId: "build-id",
	buildName: "build",
	buildNumber: "0",
	buildUrl: "https://example.com/build?x=y",
	repositoryName: "fixture",
	repositoryUrl: "https://example.com/repository",
	commit: "abc123",
	branchName: "main",
	osPlatform: "controlled",
	osRelease: "release",
	osVersion: "version",
	testEnvironment: "test",
	custom: "value=with=equals",
};
const attempt = (message, kind = "failure") => ({
	message,
	kind,
	trace: `Trace: ${message}`,
	stdout: [`${message} out`, "second line"],
	stderr: [`${message} err`],
});
export function nativeCases() {
	return [
		{
			name: "pass ✓",
			suite: "Outer.Inner",
			time: "0.017",
			duration: 17,
			status: "passed",
		},
		{
			name: "failure",
			suite: "Outer.Inner",
			time: "0",
			duration: 0,
			status: "failed",
			...attempt("initial"),
		},
		{
			name: "error",
			suite: "Outer.Inner",
			time: "1.2345",
			duration: 1235,
			status: "failed",
			...attempt("error", "error"),
		},
		{
			name: "skipped",
			suite: "Outer.Inner",
			time: "0",
			duration: 0,
			status: "skipped",
		},
		{
			name: "recovery",
			suite: "Retries",
			time: "0.023",
			duration: 23,
			status: "passed",
			history: [attempt("first"), attempt("second", "error"), attempt("third")],
			stdout: ["final out"],
			stderr: ["final err"],
		},
		{
			name: "exhausted",
			suite: "Retries",
			time: "0.031",
			duration: 31,
			status: "failed",
			history: [
				attempt("initial"),
				attempt("second", "error"),
				attempt("third"),
			],
			...attempt("final", "error"),
		},
		{
			name: "pass ✓",
			suite: "Other",
			time: "0.001",
			duration: 1,
			status: "passed",
		},
	].map((test, index) => ({
		classname: `Class${index}`,
		file: `spec/${index}.test`,
		line: index + 1,
		...test,
	}));
}
export function scenarios() {
	const cases = nativeCases();
	const full = {
		toolName: "controlled-tool",
		runId: "coordinated-run",
		envProps: Object.entries(environment).map(
			([key, value]) => `${key}=${value}`,
		),
	};
	return [
		{ name: "full", cases, options: full },
		{ name: "repeated", cases, options: full },
		{ name: "defaults", cases, options: {} },
		{
			name: "custom-identity",
			cases,
			options: { ...full, customIdentity: true },
		},
		{ name: "prefixed", cases, options: { ...full, useSuiteName: true } },
		{
			name: "minimal-source",
			cases: [
				{
					name: "minimal",
					suite: "suite",
					classname: "Class",
					time: "0",
					duration: 0,
					status: "passed",
				},
			],
			options: {},
		},
		{
			name: "zero-duration",
			cases: [{ ...cases[0], time: "0", duration: 0 }],
			options: { envProps: ["buildNumber=-1"] },
		},
		{
			name: "positive-build",
			cases,
			options: { envProps: ["buildNumber=42"] },
		},
		{ name: "nested", cases, nested: true, options: full },
		{ name: "glob", cases, glob: true, options: full },
		{
			name: "shard-one",
			cases: cases.slice(0, 4),
			options: { ...full, shardId: "one" },
		},
		{
			name: "shard-two",
			cases: cases.slice(4),
			options: { ...full, shardId: "two" },
		},
		{
			name: "reserved-dot",
			cases: [cases[0]],
			options: { envProps: ["ctrf.fixture=third-party"] },
		},
		{
			name: "reserved-slash",
			cases: [cases[0]],
			options: { envProps: ["ctrf/fixture=third-party"] },
		},
	];
}
const xmlEscape = (value) =>
	String(value)
		.replaceAll("&", "&amp;")
		.replaceAll('"', "&quot;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");
const logs = (value) =>
	["stdout", "stderr"]
		.filter((key) => value[key]?.length)
		.map(
			(key) =>
				`<system-${key === "stdout" ? "out" : "err"}>\n ${value[key].map(xmlEscape).join("\n ")}\n</system-${key === "stdout" ? "out" : "err"}>`,
		)
		.join("");
function diagnostic(tag, value, retry = false) {
	return `<${tag} message="${xmlEscape(value.message)}" type="ControlledError">${retry ? `<stackTrace>${xmlEscape(value.trace)}</stackTrace>${logs(value)}` : xmlEscape(value.trace)}</${tag}>`;
}
export function xml(cases, nested = false) {
	const suites = [...new Set(cases.map((test) => test.suite))]
		.map((suite) => {
			const tests = cases
				.filter((test) => test.suite === suite)
				.map((test) => {
					const attrs = {
						name: test.name,
						classname: test.classname,
						time: test.time,
						file: test.file,
						lineno: test.line,
					};
					let children = "";
					if (test.status === "skipped") children += "<skipped/>";
					if (test.history && test.status === "passed") {
						for (const earlier of test.history)
							children += diagnostic(
								earlier.kind === "error" ? "flakyError" : "flakyFailure",
								earlier,
								true,
							);
					} else if (test.history) {
						children += diagnostic(test.history[0].kind, test.history[0]);
						children += logs(test.history[0]);
						for (const retry of [...test.history.slice(1), test])
							children += diagnostic(
								retry.kind === "error" ? "rerunError" : "rerunFailure",
								retry,
								true,
							);
					} else if (test.status === "failed")
						children += diagnostic(test.kind, test);
					if (!test.history || test.status === "passed") children += logs(test);
					return `<testcase ${Object.entries(attrs)
						.filter(([, value]) => value !== undefined)
						.map(([key, value]) => `${key}="${xmlEscape(value)}"`)
						.join(" ")}>${children}</testcase>`;
				})
				.join("");
			return `<testsuite name="${xmlEscape(suite)}">${tests}</testsuite>`;
		})
		.join("");
	return `<?xml version="1.0" encoding="UTF-8"?><testsuites>${nested ? `<testsuite name="parent">${suites}</testsuite>` : suites}</testsuites>`;
}
export function expectedReport(scenario) {
	const { options } = scenario;
	const tests = scenario.cases.map((source) => {
		const test = {
			name: options.useSuiteName
				? `${source.suite}: ${source.name}`
				: source.name,
			status: source.status,
			duration: source.duration,
			suite: [source.suite],
			...(source.file !== undefined ? { filePath: source.file } : {}),
			...(source.line !== undefined ? { line: source.line } : {}),
		};
		for (const key of ["message", "trace", "stdout", "stderr"])
			if (source[key] !== undefined) test[key] = source[key];
		if (options.customIdentity)
			test.testId = `source:${source.classname}:${source.name}`;
		if (source.history) {
			test.retries = source.history.length;
			test.retryAttempts = source.history.map((earlier, index) => ({
				attempt: index + 1,
				status: "failed",
				message: earlier.message,
				trace: earlier.trace,
				stdout: earlier.stdout,
				stderr: earlier.stderr,
			}));
			test.sourceAttempts = [
				...source.history.map(() => ({ status: "failed" })),
				{ status: source.status, duration: source.duration },
			];
			if (source.status === "passed") test.flaky = true;
		}
		return test;
	});
	const summary = { tests: tests.length, start: 0, stop: 0 };
	for (const status of ["passed", "failed", "skipped", "pending", "other"])
		summary[status] = tests.filter((test) => test.status === status).length;
	const flaky = tests.filter((test) => test.flaky).length;
	if (flaky) summary.flaky = flaky;
	const env = {};
	for (const prop of options.envProps ?? []) {
		const split = prop.indexOf("=");
		const key = prop.slice(0, split),
			value = prop.slice(split + 1);
		if (
			key === "custom" ||
			key.startsWith("ctrf.") ||
			key.startsWith("ctrf/")
		) {
			env.extra ??= {};
			env.extra[key] = value;
		} else env[key] = key === "buildNumber" ? Number(value) : value;
	}
	if (options.shardId) env.shardId = options.shardId;
	return {
		reportFormat: "CTRF",
		specVersion: "0.2.0",
		generatedBy: "junit-to-ctrf",
		...(options.runId ? { runId: options.runId } : {}),
		results: {
			tool: { name: options.toolName ?? "junit-to-ctrf" },
			summary,
			tests,
			...(Object.keys(env).length ? { environment: env } : {}),
		},
	};
}
export function linkContext(samples) {
	return {
		samples,
		repeated: samples.filter((sample) =>
			["full", "repeated"].includes(sample.name),
		),
		shards: samples.filter((sample) => sample.name.startsWith("shard-")),
		warnings: [],
	};
}
