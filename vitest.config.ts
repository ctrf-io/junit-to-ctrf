import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    reporters: ["default", "@d2t/vitest-ctrf-json-reporter"],
  },
});
