import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createReport } from "../standard/conformance/reporters/ctrf.mjs";
export function recordsFromRun(modules, unhandledErrors) {
	const records = [];
	for (const module of modules) {
		for (const test of module.children.allTests()) {
			const result = test.result();
			records.push({
				name: `${path.basename(module.moduleId)} / ${test.fullName ?? test.name}`,
				status: test.options.mode === "todo" ? "pending" : result.state,
				duration: test.diagnostic()?.duration ?? 0,
				filePath: module.moduleId,
				message: result.errors?.map((e) => e.message).join("\n") ?? result.note,
				trace: result.errors
					?.map((e) => e.stack)
					.filter(Boolean)
					.join("\n"),
			});
		}
		for (const error of module.errors())
			records.push({
				name: `Module error: ${module.moduleId}`,
				status: "failed",
				message: error.message,
				trace: error.stack,
			});
	}
	for (const error of unhandledErrors)
		records.push({
			name: "Unhandled runner error",
			status: "failed",
			message: error.message,
			trace: error.stack,
		});
	return records;
}
export default class ReporterTestsCtrf {
	onTestRunStart() {
		this.start = Date.now();
	}
	onTestRunEnd(modules, unhandledErrors) {
		const report = createReport(
			recordsFromRun(modules, unhandledErrors),
			"reporter",
			"vitest",
			this.start ?? Date.now(),
		);
		for (const test of report.results.tests)
			test.suite = ["Reporter tests", path.basename(test.filePath ?? "setup")];
		mkdirSync("ctrf", { recursive: true });
		writeFileSync("ctrf/reporter-tests.json", JSON.stringify(report, null, 2));
	}
}
