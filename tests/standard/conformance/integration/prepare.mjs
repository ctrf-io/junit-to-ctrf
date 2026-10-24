import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	mkdtempSync,
	mkdirSync,
	writeFileSync,
	readFileSync,
	copyFileSync,
	rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expectedReport, scenarios, xml } from "../../../native/fixtures.mjs";
import { authenticScenarios } from "../../../native/authentic-junit.mjs";
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const digest = (file) =>
	createHash("sha256").update(readFileSync(file)).digest("hex");
export function integrationContext(root, diagnostics) {
	const scratch = mkdtempSync(path.join(tmpdir(), "ctrf-junit-installed-"));
	const run = (command, args, cwd) => {
		const result = spawnSync(command, args, {
			cwd,
			encoding: "utf8",
			timeout: 180_000,
		});
		assert.ifError(result.error);
		assert.equal(result.signal, null);
		return result;
	};
	try {
		if (diagnostics)
			mkdirSync(path.join(diagnostics, "fixtures"), { recursive: true });
		const packed = run(
			npm,
			["pack", "--json", "--pack-destination", scratch],
			root,
		);
		assert.equal(packed.status, 0, packed.stderr);
		const info = JSON.parse(packed.stdout)[0];
		assert.ok(info.files.some((file) => file.path === "dist/cli.js"));
		assert.ok(
			info.files.every((file) => !/^(tests|node_modules)\//u.test(file.path)),
			"New test tooling must stay out of the distribution",
		);
		const consumer = path.join(scratch, "consumer");
		mkdirSync(consumer);
		writeFileSync(
			path.join(consumer, "package.json"),
			JSON.stringify({
				name: "junit-conformance-consumer",
				private: true,
				type: "module",
			}),
		);
		const installed = run(
			npm,
			[
				"install",
				"--ignore-scripts",
				"--no-audit",
				"--no-fund",
				path.join(scratch, info.filename),
			],
			consumer,
		);
		assert.equal(installed.status, 0, installed.stderr);
		for (const file of [
			"index.js",
			"convert.js",
			"read.js",
			"identity.js",
			"cli.js",
		])
			assert.equal(
				digest(path.join(consumer, "node_modules/junit-to-ctrf/dist", file)),
				digest(path.join(root, "dist", file)),
				`Consumer must execute freshly packed ${file}`,
			);
		if (diagnostics)
			writeFileSync(
				path.join(diagnostics, "fixtures/package-inventory.json"),
				JSON.stringify(info, null, 2),
			);
		const samples = [];
		for (const scenario of [...scenarios(), ...authenticScenarios()]) {
			const folder = path.join(scratch, scenario.name);
			mkdirSync(folder);
			const groups = scenario.glob
				? [scenario.cases.slice(0, 4), scenario.cases.slice(4)]
				: [scenario.cases];
			const sources = groups.map((cases, index) => {
				const file = path.join(folder, `input-${index}.xml`);
				if (scenario.authentic) copyFileSync(scenario.sourceFile, file);
				else writeFileSync(file, xml(cases, scenario.nested));
				return { file, cases };
			});
			const config = {
				consumer,
				pattern: scenario.glob
					? path.join(folder, "input-*.xml")
					: sources[0].file,
				output: path.join(folder, "output.json"),
				observations: path.join(folder, "observations.json"),
				options: scenario.options,
				cli: ![
					"full",
					"repeated",
					"minimal-source",
					"custom-identity",
				].includes(scenario.name),
			};
			const configFile = path.join(folder, "config.json");
			writeFileSync(configFile, JSON.stringify(config));
			const start = Date.now();
			const result = run(
				process.execPath,
				[fileURLToPath(new URL("./convert.mjs", import.meta.url)), configFile],
				consumer,
			);
			if (diagnostics)
				writeFileSync(
					path.join(diagnostics, "fixtures", `${scenario.name}.log`),
					result.stdout + result.stderr,
				);
			assert.equal(
				result.status,
				0,
				`${scenario.name}: ${result.stdout} ${result.stderr}`,
			);
			const observations = JSON.parse(
				readFileSync(config.observations, "utf8"),
			);
			assert.deepEqual(
				[...observations.inputs].sort(),
				sources.map((source) => source.file).sort(),
				"Actual source selection must match independent input inventory",
			);
			const ordered = {
				...scenario,
				cases: observations.inputs.flatMap(
					(file) => sources.find((source) => source.file === file).cases,
				),
			};
			const bytes = readFileSync(config.output);
			const report = JSON.parse(bytes);
			assert.ok(
				Date.parse(report.timestamp) >= start &&
					Date.parse(report.timestamp) <= Date.now(),
				"Installed conversion timestamp",
			);
			if (diagnostics) {
				copyFileSync(
					config.output,
					path.join(diagnostics, "fixtures", `${scenario.name}.json`),
				);
				writeFileSync(
					path.join(diagnostics, "fixtures", `${scenario.name}-source.json`),
					JSON.stringify({ scenario: ordered, observations }, null, 2),
				);
				for (const [index, source] of sources.entries())
					copyFileSync(
						source.file,
						path.join(diagnostics, "fixtures", `${scenario.name}-${index}.xml`),
					);
			}
			samples.push({
				name: scenario.name,
				base64: bytes.toString("base64"),
				report,
				expected: expectedReport(ordered),
				native: ordered,
			});
		}
		return {
			samples,
			repeated: ["full", "repeated"],
			shards: ["shard-one", "shard-two"],
			warnings: [],
		};
	} finally {
		rmSync(scratch, { recursive: true, force: true });
	}
}
