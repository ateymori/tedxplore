import { randomBytes } from "node:crypto";

import { type Browser, type Page, expect } from "@playwright/test";

import { ADMIN, E2E_SLUG_PREFIX } from "./users";

/**
 * A fresh, valid slug for each event a test creates.
 *
 * Slugs are lowercase a–z only and globally unique (BR-1..BR-3), so the suffix
 * is drawn from letters — no timestamp, which would contain digits — and the
 * shared prefix lets global teardown reclaim every event the run created.
 */
export function uniqueSlug(): string {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  const suffix = Array.from(randomBytes(8), (byte) => letters[byte % letters.length]).join("");
  return `${E2E_SLUG_PREFIX}${suffix}`;
}

export interface CreatedEvent {
  eventId: string;
  slug: string;
  displayName: string;
}

/**
 * Drive the create-event form (FR-8, task 3.1) as the signed-in owner.
 *
 * Returns the identity the rest of a flow keys off — the event id from the URL
 * it lands on, and the slug/display name it submitted. A newly created event is
 * seeded with the template's demo content, which is already complete enough to
 * submit (theme, date, venue, contact all set), so callers can go straight to
 * the publish step without editing.
 */
export async function createEvent(page: Page): Promise<CreatedEvent> {
  const slug = uniqueSlug();

  await page.goto("/dashboard/events/new");

  // Typing the slug auto-fills a display-name suggestion (BR-5c); read it back
  // rather than recomputing the rule here.
  await page.locator("#slug").fill(slug);
  const displayName = await page.locator("#displayName").inputValue();

  await page.locator("#tedEventUrl").fill("https://www.ted.com/tedx/events/12345");
  await page.locator("#licenseHolderName").fill("E2E License Holder");
  // The `#authorizationConfirmed` id sits on a visually-hidden native input;
  // the operable control is the styled checkbox (role=checkbox).
  await page.getByRole("checkbox").check();

  // Wait for the debounced availability check to confirm the slug is free
  // before submitting — otherwise the click races the in-flight check, which
  // then flips to "taken" the instant creation succeeds (create-event-form.tsx).
  await expect(page.getByText("That address is available.")).toBeVisible();

  const create = page.getByRole("button", { name: "Create event" });
  await expect(create).toBeEnabled();
  await create.click();

  // The client navigates to the editor on success (`eventPath`). Exclude the
  // create page's own `/new` segment, which also matches "an id here".
  await page.waitForURL((url) => {
    const { pathname } = url;
    return /\/dashboard\/events\/[^/]+$/.test(pathname) && !pathname.endsWith("/new");
  });
  const eventId = page.url().split("/").pop() ?? "";
  expect(eventId).not.toBe("");

  return { eventId, slug, displayName };
}

/**
 * Make one autosaved edit in the hero section and wait for the "Saved"
 * indicator (FR-16, task 5.2), proving the editor's write path end to end.
 */
export async function editHeroTheme(page: Page, theme: string): Promise<void> {
  const hero = page.locator("#hero");
  await hero.locator("#hero-theme").fill(theme);
  // Debounced ~1.5s, then the per-section status flips to "Saved".
  await expect(hero.getByText("Saved")).toBeVisible({ timeout: 15_000 });
}

/**
 * Submit the current draft for review (FR-29, task 7.1) and wait for the panel
 * to reshape into its pending state.
 */
export async function submitForReview(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByText(/Submitted for review on/)).toBeVisible({ timeout: 15_000 });
}

/**
 * Approve a pending submission as the admin (FR-32, task 7.3), in that admin's
 * own authenticated context so the owner's session is untouched.
 *
 * Finds the queue row by the slug — it renders as `/tedx{slug}`, which is
 * unique — rather than by display name, then approves. Returns once the
 * decision has landed (the bar is replaced by "Already decided"), which is what
 * has run `revalidateSite` and made the public page go live.
 */
export async function adminApprove(browser: Browser, slug: string): Promise<void> {
  const context = await browser.newContext({ storageState: ADMIN.statePath });
  try {
    const page = await context.newPage();
    await page.goto("/admin");

    const row = page.getByRole("link").filter({ hasText: `/tedx${slug}` });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.click();

    await page.waitForURL(/\/admin\/review\/[^/]+$/);
    await page.getByRole("button", { name: "Approve and publish" }).click();

    await expect(page.getByText("Already decided")).toBeVisible({ timeout: 15_000 });
  } finally {
    await context.close();
  }
}
