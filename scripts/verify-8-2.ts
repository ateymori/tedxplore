/**
 * Task 8.2 verification — SEO output over real HTTP.
 *
 * Run against a production server (`pnpm build && pnpm start -p 3100`):
 *
 *   pnpm exec tsx --tsconfig tsconfig.script.json scripts/verify-8-2.ts
 *
 * Needs no database of its own — it reads what the server serves, which is the
 * point. Metadata is the one part of the app whose output nobody looks at
 * directly: a broken card renders as an unremarkable link, and a leaked title
 * shows up in someone else's search results, not ours.
 */
import "dotenv/config";

import { APP_URL } from "@/config/site";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3100";
const LIVE_SLUG = "avelorne";
const LIVE_NAME = "TEDxAvelorne";
const UNPUBLISHED_SLUG = "demoevent";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function get(path: string) {
  const response = await fetch(`${BASE}${path}`);
  return { status: response.status, body: await response.text() };
}

/** Reads a `<meta>` content value by `name` or `property`. */
function meta(html: string, key: string): string | null {
  const pattern = new RegExp(
    `<meta[^>]*(?:name|property)="${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*content="([^"]*)"`,
    "i",
  );
  return pattern.exec(html)?.[1] ?? null;
}

async function main() {
  console.log(`\nVerifying SEO output at ${BASE}\n`);

  console.log("Per-site metadata (FR-47)");
  const site = await get(`/tedx${LIVE_SLUG}`);
  {
    const title = /<title>([^<]*)<\/title>/.exec(site.body)?.[1] ?? null;
    check("the title is the event's own name", title === LIVE_NAME, `got ${String(title)}`);
    check(
      "the platform's name is not appended to it",
      title !== null && !title.includes("Tedxplore"),
      "an event site should not be titled '… · Tedxplore'",
    );

    check(
      "a description is present",
      (meta(site.body, "description")?.length ?? 0) > 0,
      "no description meta tag",
    );

    const canonical = /<link[^>]*rel="canonical"[^>]*href="([^"]*)"/.exec(site.body)?.[1] ?? null;
    check(
      "the canonical URL points at the configured origin",
      canonical === `${APP_URL}/tedx${LIVE_SLUG}`,
      `got ${String(canonical)}`,
    );
  }

  console.log("\nSocial cards");
  {
    check("og:title is the event name", meta(site.body, "og:title") === LIVE_NAME);
    check("og:type is website", meta(site.body, "og:type") === "website");
    check(
      "og:url matches the canonical",
      meta(site.body, "og:url") === `${APP_URL}/tedx${LIVE_SLUG}`,
    );

    const image = meta(site.body, "og:image");
    check("og:image is present", image !== null, "the demo event has a hero image, so it must be");
    check("og:image is declared at 1200×630", meta(site.body, "og:image:width") === "1200");
    check("og:image carries alt text", meta(site.body, "og:image:alt") === LIVE_NAME);
    check(
      "the card image is cropped, not letterboxed",
      image !== null && image.includes("c_fill") && image.includes("g_auto"),
      "expected c_fill,g_auto in the transform",
    );
    check(
      "twitter uses the large card when there is an image",
      meta(site.body, "twitter:card") === "summary_large_image",
    );

    if (image !== null) {
      const response = await fetch(image);
      check(
        "the card image actually resolves",
        response.ok && (response.headers.get("content-type")?.startsWith("image/") ?? false),
        `got ${response.status} ${String(response.headers.get("content-type"))}`,
      );
    }
  }

  console.log("\nA non-live site leaks nothing (FR-42)");
  {
    const dark = await get(`/tedx${UNPUBLISHED_SLUG}`);
    check("still a real 404", dark.status === 404, `got ${dark.status}`);
    check(
      "is marked noindex",
      meta(dark.body, "robots")?.includes("noindex") ?? false,
      "a 404 must not be indexable",
    );
    check(
      "carries no card metadata at all",
      meta(dark.body, "og:image") === null && meta(dark.body, "og:title") === null,
      "a dark site must not keep rendering link previews",
    );
  }

  console.log("\nThe sitemap");
  {
    const sitemap = await get("/sitemap.xml");
    check("is served", sitemap.status === 200, `got ${sitemap.status}`);
    check("lists the homepage", sitemap.body.includes(`<loc>${APP_URL}/</loc>`));
    check(
      "lists the live site",
      sitemap.body.includes(`<loc>${APP_URL}/tedx${LIVE_SLUG}</loc>`),
      "a published site must be discoverable",
    );
    check(
      "does not list the unpublished one",
      !sitemap.body.includes(`tedx${UNPUBLISHED_SLUG}`),
      "the sitemap would be a directory of unpublished slugs",
    );
    check(
      "carries a lastmod for the live site",
      /<lastmod>/.test(sitemap.body),
      "no lastmod element",
    );
    check(
      "does not list preview or dashboard URLs",
      !sitemap.body.includes("/preview") && !sitemap.body.includes("/dashboard"),
    );
  }

  console.log("\nrobots.txt");
  {
    const robots = await get("/robots.txt");
    check("is served", robots.status === 200, `got ${robots.status}`);
    check("allows the public surface", /^Allow: \/$/m.test(robots.body));

    for (const path of ["/dashboard/", "/admin/", "/preview/", "/api/", "/templates/"]) {
      check(`disallows ${path}`, robots.body.includes(`Disallow: ${path}`));
    }

    check(
      "does not disallow the event sites themselves",
      !robots.body.includes("Disallow: /tedx"),
      "that would deindex every published site",
    );
    check("points at the sitemap", robots.body.includes(`Sitemap: ${APP_URL}/sitemap.xml`));
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
