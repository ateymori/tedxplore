import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

import { type Browser, test as setup } from "@playwright/test";

import { closeDb, findUserByEmail, markVerifiedWithRole } from "./support/db";
import { OWNER, ADMIN, type TestUser } from "./support/users";

/**
 * One-time authentication setup (Playwright's project-dependency pattern).
 *
 * Runs before every test project and leaves behind a signed-in storage-state
 * file per user, which the tests load instead of logging in themselves. The
 * whole point is to keep sign-ins scarce: Better Auth rate-limits
 * `/sign-in/email` to 5/minute even in development (task 9.4), so a suite that
 * authenticated per test would throttle itself into flakiness.
 *
 * Two things have to be true before the login form will work, and neither can
 * be done through the browser:
 *
 *  1. The account must exist with a real password hash — created through Better
 *     Auth's own sign-up endpoint, since only it hashes the password the way
 *     sign-in verifies it.
 *  2. The email must be verified — Better Auth issues no session otherwise
 *     (FR-3), and in local dev the verification email is only printed to the
 *     server console, so there is no link to click. We flip the flag directly.
 *
 * Existing valid state is reused rather than re-created, so warm reruns perform
 * zero sign-ins and stay well under the rate limit.
 */

const authDir = path.join(__dirname, ".auth");

setup.beforeAll(() => {
  mkdirSync(authDir, { recursive: true });
});

setup("provision and authenticate owner", async ({ browser, baseURL }) => {
  await ensureUser(OWNER, baseURL);
  await ensureAuthed(browser, OWNER);
});

setup("provision and authenticate admin", async ({ browser, baseURL }) => {
  await ensureUser(ADMIN, baseURL);
  await ensureAuthed(browser, ADMIN);
});

setup.afterAll(async () => {
  await closeDb();
});

/**
 * Make sure the account exists, is verified, and carries the right role.
 *
 * Idempotent: signs up only when the row is genuinely missing (so reruns don't
 * spend the sign-up rate-limit budget), then reconciles the verified flag and
 * role every time.
 */
async function ensureUser(user: TestUser, baseURL: string | undefined): Promise<void> {
  const existing = await findUserByEmail(user.email);

  if (existing === null) {
    const response = await fetch(`${baseURL}/api/auth/sign-up/email`, {
      method: "POST",
      // Better Auth rejects a cross-origin/originless mutation (MISSING_OR_NULL
      // _ORIGIN). This request comes from Node, not a browser, so set the
      // Origin explicitly to the app's own base URL.
      headers: { "Content-Type": "application/json", Origin: baseURL ?? "" },
      body: JSON.stringify({ email: user.email, password: user.password, name: user.name }),
    });
    if (!response.ok) {
      throw new Error(
        `Sign-up failed for ${user.email}: ${response.status} ${await response.text()}`,
      );
    }
  }

  // Verify + set role directly — the parts Better Auth won't do for us in dev.
  await markVerifiedWithRole(user.email, user.role);
}

/**
 * Produce `user.statePath`, reusing an unexpired session if one is already on
 * disk. Only a genuine sign-in touches the rate limiter.
 */
async function ensureAuthed(browser: Browser, user: TestUser): Promise<void> {
  if (existsSync(user.statePath) && (await stateStillValid(browser, user.statePath))) {
    return;
  }

  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto("/login");
    await page.locator("#email").fill(user.email);
    await page.locator("#password").fill(user.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    // The form navigates to the dashboard on success (login-form.tsx).
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
    await context.storageState({ path: user.statePath });
  } finally {
    await context.close();
  }
}

/** True if the saved cookies still resolve to an authenticated dashboard. */
async function stateStillValid(browser: Browser, statePath: string): Promise<boolean> {
  const context = await browser.newContext({ storageState: statePath });
  try {
    const page = await context.newPage();
    await page.goto("/dashboard");
    // An expired or absent session gets bounced to /login by the guard.
    return /\/dashboard/.test(page.url());
  } catch {
    return false;
  } finally {
    await context.close();
  }
}
