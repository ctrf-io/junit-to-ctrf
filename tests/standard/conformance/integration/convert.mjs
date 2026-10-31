import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const config = JSON.parse(readFileSync(process.argv[2], "utf8"));
const installed = path.join(config.consumer, "node_modules/junit-to-ctrf");
const { glob } = await import(
	pathToFileURL(
		path.join(config.consumer, "node_modules/glob/dist/esm/index.js"),
	)
);
// Observe source selection before conversion; never use the subject CTRF as an oracle.
const inputs = await glob(config.pattern);
writeFileSync(config.observations, JSON.stringify({ inputs }));
if (config.cli) {
	const args = [
		path.join(installed, "dist/cli.js"),
		config.pattern,
		"--output",
		config.output,
		"--use-suite-name",
		String(config.options.useSuiteName ?? false),
	];
	for (const [key, flag] of [
		["toolName", "--tool"],
		["runId", "--run-id"],
		["shardId", "--shard-id"],
	])
		if (config.options[key] !== undefined) args.push(flag, config.options[key]);
	if (config.options.envProps) args.push("--env", ...config.options.envProps);
	const result = spawnSync(process.execPath, args, {
		cwd: config.consumer,
		encoding: "utf8",
		timeout: 30_000,
	});
	assert.ifError(result.error);
	assert.equal(result.signal, null);
	process.stdout.write(result.stdout);
	process.stderr.write(result.stderr);
	if (config.rejection) {
		assert.equal(result.status, 1, "Invalid environment options must fail");
		assert.match(result.stderr, new RegExp(config.rejection));
		assert.equal(
			existsSync(config.output),
			false,
			"Rejected options must not write a report",
		);
	} else assert.equal(result.status, 0, "Valid XML conversion must complete");
} else {
	const { convertJUnitToCTRFReport } = await import(
		pathToFileURL(path.join(installed, "dist/index.js"))
	);
	if (config.rejection) {
		await assert.rejects(
			() =>
				convertJUnitToCTRFReport(config.pattern, {
					...config.options,
					outputPath: config.output,
				}),
			new RegExp(config.rejection),
		);
		assert.equal(
			existsSync(config.output),
			false,
			"Rejected options must not write a report",
		);
		process.exit(0);
	}
	const report = await convertJUnitToCTRFReport(config.pattern, {
		...config.options,
		outputPath: config.output,
		...(config.options.customIdentity
			? { testIdResolver: (test) => `source:${test.suite[1]}:${test.name}` }
			: {}),
	});
	assert.ok(report, "Controlled source must contain test cases");
}
