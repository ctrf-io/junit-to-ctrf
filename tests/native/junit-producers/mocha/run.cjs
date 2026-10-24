const fs = require("node:fs");
const Mocha = require("mocha");
const native = [];
class ObservedXUnit extends Mocha.reporters.XUnit {
	constructor(runner, options) {
		super(runner, options);
		runner.on("test end", (test) =>
			native.push({
				name: test.title,
				fullName: test.fullTitle(),
				status: test.pending ? "skipped" : test.state,
				duration: test.duration ?? 0,
				retries: test.currentRetry(),
			}),
		);
	}
}
const mocha = new Mocha({
	reporter: ObservedXUnit,
	reporterOptions: { output: "mocha-xunit.xml" },
});
mocha.addFile("mocha/cases.cjs");
mocha.run((failures) => {
	fs.writeFileSync("mocha-native.json", JSON.stringify(native, null, 2));
	process.exitCode = failures ? 1 : 0;
});
