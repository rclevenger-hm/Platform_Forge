import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4173/Platform_Forge/",
    headless: true,
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },
  webServer: {
    command:
      "BASE_PATH=/Platform_Forge/ npm run build && npm run preview -- --port 4173",
    url: "http://127.0.0.1:4173/Platform_Forge/",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  reporter: "list",
});
