import { checkEntry } from "./shared/checks.mjs";
export const expectedFailures = {};
export function expectedFailure() {
	return undefined;
}
export function runConformance(entry, context) {
	return checkEntry(entry, context);
}
