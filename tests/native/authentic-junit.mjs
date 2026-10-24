import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
export function authenticScenarios() {
	const manifest = JSON.parse(
		readFileSync(new URL("./junit-fixtures/manifest.json", import.meta.url)),
	);
	for (const [file, hash] of Object.entries(manifest.sources))
		assert.equal(
			digest(
				readFileSync(new URL(`./junit-producers/${file}`, import.meta.url)),
			),
			hash,
			`Source fixture changed: ${file}; regenerate the authentic reports`,
		);
	return manifest.reports.map((fixture) => {
		const sourceFile = fileURLToPath(
			new URL(`./junit-fixtures/${fixture.file}`, import.meta.url),
		);
		assert.equal(
			digest(readFileSync(sourceFile)),
			fixture.sha256,
			`Authentic XML changed: ${fixture.file}`,
		);
		return {
			name: `authentic-${fixture.id}`,
			cases: fixture.cases,
			options: {},
			authentic: true,
			fixture,
			sourceFile,
		};
	});
}
