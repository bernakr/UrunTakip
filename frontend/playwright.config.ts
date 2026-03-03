import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 120_000,
  expect: {
    timeout: 15_000
  },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: process.env.E2E_FRONTEND_URL ?? "http://127.0.0.1:5173",
    trace: "retain-on-failure",
    video: "retain-on-failure"
  },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list"
});
