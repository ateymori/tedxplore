import path from "node:path";

import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

import { OWNER } from "./e2e/support/users";

// The E2E harness talks to the database directly (setup + teardown), so it
// needs the same DATABASE_URL the app uses. Load `.env` into the test runner's
// own process; `next dev` loads it independently for the server.
dotenv.config({ path: path.join(__dirname, ".env") });

/**
 * Playwright smoke suite (task 10.1).
 *
 * The app must run on the port `NEXT_PUBLIC_APP_URL` names — Better Auth signs
 * cookies against that origin and rejects sign-in from any other (the
 * INVALID_ORIGIN class of failure noted in CLAUDE.md), so the base URL and the
 * dev server share it.
 *
 * `workers: 1` deliberately: every test shares one dev database and one global
 * auth rate limiter, so serial execution is what keeps them from interfering.
 * This is a handful of smoke flows, not a parallel unit suite.
 */
const baseURL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  globalTeardown: "./e2e/global-teardown.ts",

  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",

  timeout: 90_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL,
    trace: "on-first-retry",
    // First-hit route compilation on the dev server is slow; give navigations
    // room rather than chasing flakes with per-call overrides.
    navigationTimeout: 45_000,
    actionTimeout: 20_000,
  },

  projects: [
    // Seeds verified accounts and writes each user's signed-in storage state.
    { name: "setup", testMatch: /auth\.setup\.ts/ },

    {
      name: "chromium",
      testMatch: /.*\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        // Most tests act as the owner; the ones that need a signed-out visitor
        // or the admin override this per-file / per-context.
        storageState: OWNER.statePath,
      },
    },
  ],

  webServer: {
    command: "pnpm dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
