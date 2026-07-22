import { expect, test } from "@playwright/test";

import { createEvent } from "./support/helpers";

/**
 * Preview links (FR-25, FR-26).
 *
 * The owner shares a private, read-only link to their draft; anyone with it can
 * view the site without an account; turning it off stops it working on the very
 * next request. The anonymous viewer runs in a separate, sessionless context.
 */
test("owner shares a preview link, a visitor views it, revoking kills it", async ({
  page,
  browser,
}) => {
  const { displayName } = await createEvent(page);

  // Open the Share dialog and create the link (task 6.3).
  await page.getByRole("button", { name: "Share" }).click();
  await page.getByRole("button", { name: "Create preview link" }).click();

  const linkInput = page.getByRole("textbox", { name: "Preview link" });
  await expect(linkInput).toBeVisible();
  const previewUrl = await linkInput.inputValue();
  expect(previewUrl).toContain("/preview/");

  // A visitor with no session opens the link and sees the draft rendered.
  const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  try {
    const visitor = await anon.newPage();
    await visitor.goto(previewUrl);
    await expect(visitor.getByRole("heading", { name: displayName, level: 1 })).toBeVisible();

    // The owner turns the link off (FR-26).
    await page.getByRole("button", { name: "Turn off link" }).click();
    await expect(page.getByRole("button", { name: "Create preview link" })).toBeVisible();

    // The same link no longer serves the draft — it hits the branded dead end.
    await visitor.goto(previewUrl);
    await expect(
      visitor.getByRole("heading", { name: /This preview link isn.t active/ }),
    ).toBeVisible();
  } finally {
    await anon.close();
  }
});
