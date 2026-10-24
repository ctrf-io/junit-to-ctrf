describe("native suite", () => {
	it("pass ✓", () => {
		console.log("mocha pass output");
	});
	it("failure", () => {
		throw new Error("mocha fixture failure");
	});
	it.skip("skipped", () => {});
	it("retry recovery", function () {
		if (this.test.currentRetry() === 0)
			throw new Error("mocha initial failure");
	}).retries(1);
});
