import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	cpSync,
	copyFileSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import xml2js from "xml2js";
const source = fileURLToPath(new URL(".", import.meta.url));
const output = fileURLToPath(new URL("../junit-fixtures/", import.meta.url));
const scratch = mkdtempSync(path.join(tmpdir(), "ctrf-junit-producers-"));
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const env = {
	...process.env,
	npm_config_cache: path.join(scratch, "npm-cache"),
	PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: "1",
	GOBIN: path.join(scratch, "bin"),
	GOPATH: path.join(scratch, "gopath"),
	GOCACHE: path.join(scratch, "go-cache"),
};
function run(name, command, args, cwd = scratch, status = 0) {
	const result = spawnSync(command, args, {
		cwd,
		env,
		encoding: "utf8",
		timeout: 300_000,
		maxBuffer: 20 * 1024 * 1024,
	});
	if (process.env.CTRF_JUNIT_ARTIFACTS) {
		mkdirSync(process.env.CTRF_JUNIT_ARTIFACTS, { recursive: true });
		writeFileSync(
			path.join(process.env.CTRF_JUNIT_ARTIFACTS, `${name}.log`),
			result.stdout + result.stderr,
		);
	}
	assert.ifError(result.error);
	assert.equal(result.signal, null);
	assert.equal(
		result.status,
		status,
		`${name}: ${result.stdout} ${result.stderr}`,
	);
	return result.stdout;
}
function leaves(suite, parents = []) {
	return [
		...(suite.specs ?? []).map((spec) => ({ spec, parents })),
		...(suite.suites ?? []).flatMap((child) =>
			leaves(child, [...parents, child.title]),
		),
	];
}
try {
	for (const file of ["package.json", "package-lock.json"])
		copyFileSync(path.join(source, file), path.join(scratch, file));
	for (const directory of ["playwright", "vitest", "mocha", "go"])
		cpSync(path.join(source, directory), path.join(scratch, directory), {
			recursive: true,
		});
	run("install", npm, ["ci", "--ignore-scripts", "--no-audit", "--no-fund"]);
	run(
		"playwright",
		process.execPath,
		[
			"node_modules/@playwright/test/cli.js",
			"test",
			"--config=playwright/playwright.config.cjs",
		],
		scratch,
		1,
	);
	run(
		"vitest",
		process.execPath,
		[
			"node_modules/vitest/vitest.mjs",
			"run",
			"--config=vitest/vitest.config.mjs",
		],
		scratch,
		1,
	);
	run("mocha", process.execPath, ["mocha/run.cjs"], scratch, 1);
	const goVersion = run("go-version", "go", ["version"]).trim();
	run("go-exporter-install", "go", [
		"install",
		"github.com/jstemmer/go-junit-report/v2@v2.1.0",
	]);
	const goJSON = run(
		"go-native",
		"go",
		["test", "-json", "-count=1", "./..."],
		path.join(scratch, "go"),
		1,
	);
	writeFileSync(path.join(scratch, "go-native.json"), goJSON);
	run(
		"go-export",
		path.join(
			env.GOBIN,
			process.platform === "win32" ? "go-junit-report.exe" : "go-junit-report",
		),
		[
			"-parser",
			"gojson",
			"-in",
			path.join(scratch, "go-native.json"),
			"-out",
			path.join(scratch, "go.xml"),
		],
	);
	const pw = JSON.parse(
		readFileSync(path.join(scratch, "playwright-native.json")),
	);
	const vitest = JSON.parse(
		readFileSync(path.join(scratch, "vitest-native.json")),
	);
	const mocha = JSON.parse(
		readFileSync(path.join(scratch, "mocha-native.json")),
	);
	const observations = {
		playwright: pw.suites
			.flatMap((suite) => leaves(suite))
			.map(({ spec, parents }) => {
				const test = spec.tests[0];
				return {
					name: [...parents, spec.title].join(" › "),
					status: test.results.at(-1).status,
					duration: test.results.reduce(
						(sum, attempt) => sum + attempt.duration,
						0,
					),
					attempts: test.results.map((attempt) => ({
						status: attempt.status,
						duration: attempt.duration,
					})),
				};
			}),
		vitest: vitest.testResults.flatMap((file) =>
			file.assertionResults.map((test) => ({
				name: [...test.ancestorTitles, test.title].join(" > "),
				nativeName: test.fullName,
				recoveredAfterFailure:
					test.status === "passed" && test.failureMessages.length > 0,
				status: test.status === "pending" ? "skipped" : test.status,
				duration: test.duration ?? 0,
			})),
		),
		"mocha-xunit": mocha.map((test) => ({
			...test,
			name: test.name,
			status:
				test.status === "passed"
					? "passed"
					: test.status === "failed"
						? "failed"
						: "skipped",
		})),
		go: goJSON
			.trim()
			.split("\n")
			.map((line) => JSON.parse(line))
			.filter(
				(event) =>
					event.Test && ["pass", "fail", "skip"].includes(event.Action),
			)
			.map((event) => ({
				name: event.Test,
				status: { pass: "passed", fail: "failed", skip: "skipped" }[
					event.Action
				],
				duration: (event.Elapsed ?? 0) * 1000,
			})),
	};
	assert.deepEqual(
		observations.playwright
			.find((test) => test.name.endsWith("retry recovery"))
			.attempts.map((attempt) => attempt.status),
		["failed", "passed"],
	);
	assert.equal(
		observations.vitest.find((test) => test.name.endsWith("retry recovery"))
			.recoveredAfterFailure,
		true,
	);
	assert.equal(
		observations["mocha-xunit"].find((test) => test.name === "retry recovery")
			.retries,
		1,
	);
	const files = [];
	for (const [id, native] of Object.entries(observations)) {
		const wanted =
			id === "go"
				? [
						["TestPass", "passed"],
						["TestFailure", "failed"],
						["TestSkip", "skipped"],
					]
				: ["pass ✓", "failure", "skipped", "retry recovery"].map((name) => [
						id === "mocha-xunit"
							? name
							: `native suite${id === "playwright" ? " › " : " > "}${name}`,
						name === "failure"
							? "failed"
							: name === "skipped"
								? "skipped"
								: "passed",
					]);
		assert.deepEqual(
			native.map((test) => [test.name, test.status]),
			wanted,
			`${id}: native inventory/outcomes`,
		);
		const bytes = readFileSync(path.join(scratch, `${id}.xml`));
		const document = await xml2js.parseStringPromise(bytes);
		const suites = document.testsuites?.testsuite ?? [document.testsuite];
		const cases = suites.flatMap((suite) =>
			(suite.testcase ?? []).map((test) => ({
				name: test.$.name,
				suite: suite.$.name,
				duration: Math.round(Number(test.$.time ?? 0) * 1000),
				status:
					test.failure !== undefined || test.error !== undefined
						? "failed"
						: test.skipped !== undefined
							? "skipped"
							: "passed",
			})),
		);
		const xmlTests = suites.flatMap((suite) => suite.testcase ?? []);
		for (const [index, test] of xmlTests.entries()) {
			const problem = test.failure?.[0] ?? test.error?.[0];
			const trace = typeof problem === "string" ? problem : problem?._;
			if (trace?.trim()) cases[index].trace = trace;
			if (problem?.$?.message) cases[index].message = problem.$.message;
			if (test.$.file) cases[index].file = test.$.file;
		}
		assert.equal(cases.length, native.length, `${id}: XML test inventory`);
		for (const test of cases) {
			const observed = native.find((item) => item.name === test.name);
			assert.ok(observed, `${id}: unexpected XML case ${test.name}`);
			assert.equal(
				test.status,
				observed.status,
				`${id}: XML status matches native observation`,
			);
			assert.ok(
				Math.abs(test.duration - observed.duration) <= 1,
				`${id}/${test.name}: XML time ${test.duration} vs native ${observed.duration}`,
			);
		}
		const packageName = {
			playwright: "@playwright/test",
			vitest: "vitest",
			"mocha-xunit": "mocha",
		}[id];
		files.push({
			id,
			file: `${id}.xml`,
			sha256: hash(bytes),
			framework:
				id === "go"
					? goVersion
					: `${packageName}@${JSON.parse(readFileSync(path.join(scratch, "node_modules", packageName, "package.json"))).version}`,
			exporter:
				id === "go" ? "go-junit-report/v2@v2.1.0 (gojson parser)" : "built-in",
			sourceExit: 1,
			cases,
			native,
		});
	}
	// Copy only after all real runs and independent source checks succeeded.
	mkdirSync(output, { recursive: true });
	for (const item of files)
		copyFileSync(path.join(scratch, item.file), path.join(output, item.file));
	const sources = [
		"generate.mjs",
		"package.json",
		"package-lock.json",
		"playwright/cases.spec.cjs",
		"playwright/playwright.config.cjs",
		"vitest/cases.test.mjs",
		"vitest/vitest.config.mjs",
		"mocha/cases.cjs",
		"mocha/run.cjs",
		"go/go.mod",
		"go/cases_test.go",
	];
	writeFileSync(
		path.join(output, "manifest.json"),
		`${JSON.stringify({ node: process.version, sources: Object.fromEntries(sources.map((file) => [file, hash(readFileSync(path.join(source, file)))])), reports: files }, null, 2)}\n`,
	);
	console.log(
		`Collected ${files.length} authentic reports with verified native inventories`,
	);
} finally {
	if (process.env.CTRF_JUNIT_ARTIFACTS)
		for (const file of [
			"playwright.xml",
			"playwright-native.json",
			"vitest.xml",
			"vitest-native.json",
			"mocha-xunit.xml",
			"mocha-native.json",
			"go.xml",
			"go-native.json",
		])
			if (existsSync(path.join(scratch, file)))
				copyFileSync(
					path.join(scratch, file),
					path.join(process.env.CTRF_JUNIT_ARTIFACTS, file),
				);
	// Go's module cache is read-only; make task-owned directories writable first.
	const { chmodSync, readdirSync, lstatSync } = await import("node:fs");
	function writable(directory) {
		chmodSync(directory, 0o755);
		for (const name of readdirSync(directory)) {
			const child = path.join(directory, name);
			if (lstatSync(child).isDirectory()) writable(child);
		}
	}
	writable(scratch);
	rmSync(scratch, { recursive: true, force: true });
}
