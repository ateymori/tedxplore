import { expect, test } from "@playwright/test";

import { OWNER } from "./support/users";

/**
 * Homepage → Edit → login → create (FR-51).
 *
 * A signed-out visitor who presses Edit is routed through login and lands back
 * on event creation for the template they chose — the `returnTo` handoff built
 * in task 2.4 and wired to the Edit button in Phase 4.
 *
 * Runs as a genuinely signed-out visitor, so it overrides the project's default
 * owner storage state. It performs a real sign-in through the form — the one
 * test in the suite that does — which is why the flows that only need an
 * authenticated session reuse saved state instead.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test("Edit from the homepage routes through login to event creation", async ({ page }) => {
  await page.goto("/");

  // The Edit action renders through the Button component, which sets
  // role="button" on its anchor even though it navigates.
  await page.getByRole("button", { name: /^Edit/ }).first().click();

  // Signed out, Edit goes to login carrying a returnTo to the create flow.
  await page.waitForURL(/\/login\?/);
  expect(page.url()).toContain("returnTo");

  await page.locator("#email").fill(OWNER.email);
  await page.locator("#password").fill(OWNER.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  // After authenticating, the returnTo lands the visitor on create-event.
  await page.waitForURL(/\/dashboard\/events\/new/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Create your event site" })).toBeVisible();
});
