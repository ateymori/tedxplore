import { expect, test } from "@playwright/test";

import { adminApprove, createEvent, editHeroTheme, submitForReview } from "./support/helpers";

/**
 * The full publishing lifecycle, plus a report on the resulting live site
 * (FR-8, FR-16, FR-29, FR-32, FR-42, FR-45).
 *
 * One continuous flow, run as the owner (project default) with the admin acting
 * in a separate context inside `adminApprove`:
 *
 *   create → edit (autosave) → submit for review → admin approve →
 *   public site is live → a visitor reports it.
 *
 * A newly created event is seeded with complete demo content, so it is
 * submittable without further editing; the edit step is here to prove the
 * autosave write path, not to satisfy the completeness gate.
 */
test("create → edit → submit → approve → public view → report", async ({ page, browser }) => {
  // Create.
  const { slug, displayName } = await createEvent(page);
  expect(displayName).not.toBe("");

  // Edit — one autosaved change, confirmed by the "Saved" indicator.
  await editHeroTheme(page, "Ideas worth spreading, tested by E2E");

  // Submit for review.
  await submitForReview(page);

  // Approve, as the admin, in their own context.
  await adminApprove(browser, slug);

  // Public view: the site is now live at /tedx{slug}, rendered by the template.
  await page.goto(`/tedx${slug}`);
  await expect(page.getByRole("heading", { name: displayName, level: 1 })).toBeVisible();

  // Report the live site (FR-45): the affordance lives in the template footer.
  await page.getByRole("button", { name: "Report this site" }).click();
  await expect(page.getByRole("heading", { name: "Report this site" })).toBeVisible();

  await page
    .locator("#report-explanation")
    .fill("This is an automated end-to-end smoke test of the report flow.");
  await page.getByRole("button", { name: "Send report" }).click();

  // The endpoint returns an accepted response and the dialog thanks the reporter
  // (task 9.2 — the same response whether stored, honeypotted, or unknown).
  await expect(page.getByRole("heading", { name: "Thank you" })).toBeVisible();
});
