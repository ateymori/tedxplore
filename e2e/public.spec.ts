import { expect, test } from "@playwright/test";

/**
 * Homepage → Live Preview (FR-49, FR-50).
 *
 * The public entry point: a visitor can read what the product is and open a
 * complete, real event site without an account. Live Preview opens the demo
 * content through the actual template in a new tab.
 */
test.describe("homepage and live preview", () => {
  test("homepage shows the value proposition and template grid", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", {
        name: /Premium TEDx event websites\.?\s*Built from your content/i,
      }),
    ).toBeVisible();

    await expect(page.getByRole("heading", { name: "Choose your template" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Aurora" })).toBeVisible();
  });

  test("Live preview opens the demo site in a new tab", async ({ page, context }) => {
    await page.goto("/");

    // The Live preview action is an anchor to the template preview route,
    // opened in a new tab (template-card.tsx).
    const previewLink = page.locator('a[href*="/templates/"][target="_blank"]').first();
    await expect(previewLink).toBeVisible();

    const [preview] = await Promise.all([context.waitForEvent("page"), previewLink.click()]);

    await preview.waitForLoadState("domcontentloaded");
    await expect(preview).toHaveURL(/\/templates\/[^/]+\/preview/);

    // The demo site renders its display name as the hero heading.
    await expect(preview.getByRole("heading", { name: /TEDxAurora Bay/i, level: 1 })).toBeVisible();
  });
});
