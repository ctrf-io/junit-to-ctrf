import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { glob } from "glob";
import { authenticScenarios } from "../../../native/authentic-junit.mjs";
import {
	expectedReport,
	linkContext,
	scenarios,
	xml,
} from "../../../native/fixtures.mjs";
export async function unitContext(producer) {
	const { convertJUnitToCTRFReport } =
		producer ?? (await import("../../../../dist/index.js"));
	const scratch = await mkdtemp(path.join(tmpdir(), "ctrf-junit-unit-"));
	try {
		const samples = [];
		for (const scenario of [...scenarios(), ...authenticScenarios()]) {
			const directory = path.join(scratch, scenario.name);
			await mkdir(directory);
			const groups = scenario.glob
				? [scenario.cases.slice(0, 4), scenario.cases.slice(4)]
				: [scenario.cases];
			const sources = [];
			for (const [index, cases] of groups.entries()) {
				const file = path.join(directory, `input-${index}.xml`);
				await writeFile(
					file,
					scenario.authentic
						? await readFile(scenario.sourceFile)
						: xml(cases, scenario.nested),
				);
				sources.push({ file, cases });
			}
			const input = scenario.glob
				? path.join(directory, "input-*.xml")
				: sources[0].file;
			const files = await glob(input);
			assert.deepEqual(
				[...files].sort(),
				sources.map((source) => source.file).sort(),
			);
			const ordered = {
				...scenario,
				cases: files.flatMap(
					(file) => sources.find((source) => source.file === file).cases,
				),
			};
			const outputPath = path.join(directory, "output.json");
			const start = Date.now();
			if (scenario.rejection) {
				await assert.rejects(
					() =>
						convertJUnitToCTRFReport(input, {
							...scenario.options,
							outputPath,
						}),
					new RegExp(scenario.rejection),
				);
				await assert.rejects(() => readFile(outputPath), { code: "ENOENT" });
				continue;
			}
			await convertJUnitToCTRFReport(input, {
				...scenario.options,
				outputPath,
				...(scenario.options.customIdentity
					? { testIdResolver: (test) => `source:${test.suite[1]}:${test.name}` }
					: {}),
			});
			const bytes = await readFile(outputPath);
			const report = JSON.parse(bytes);
			assert.ok(
				Date.parse(report.timestamp) >= start &&
					Date.parse(report.timestamp) <= Date.now(),
				"Document timestamp reflects conversion, not source test execution",
			);
			samples.push({
				name: scenario.name,
				bytes,
				report,
				expected: expectedReport(ordered),
				native: ordered,
			});
		}
		return linkContext(samples);
	} finally {
		await rm(scratch, { recursive: true, force: true });
	}
}
