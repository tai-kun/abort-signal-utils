import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
  oxc: {
    target: "es2020",
  },
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/**/*.server.test.ts"],
    browser: {
      provider: playwright(),
      enabled: true,
      headless: true,
      instances: [{ browser: "chromium" }, { browser: "firefox" }, { browser: "webkit" }],
    },
    coverage: {
      provider: "istanbul",
      reporter: ["text", "json-summary", "html"],
      include: ["src/**/*.ts"],
      reportsDirectory: "./coverage/client",
    },
  },
});
