import { defineConfig, devices } from "@playwright/test";

// The suite jsdom cannot run: the scroll film, the real focus order, and the
// contrast a browser actually paints.
//
// `pnpm e2e` starts the same Node server the site is developed against, on a
// spare port so it never fights a running `pnpm dev`.

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node index.js",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
    env: { PORT: "3100" },
  },
});
