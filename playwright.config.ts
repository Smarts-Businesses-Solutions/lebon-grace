import { defineConfig, devices } from "@playwright/test";
import { makeBaseConfig } from "../ops/qa/playwright.base.config";

const base = makeBaseConfig(devices);

export default defineConfig({
  ...base,
  testDir: "./tests/e2e",
  use: {
    ...base.use,
    baseURL: process.env.QA_BASE_URL ?? "http://127.0.0.1:3105",
  },
});
