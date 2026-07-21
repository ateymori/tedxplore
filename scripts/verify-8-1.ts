/**
 * Task 8.1 verification — the public site route over real HTTP.
 *
 * Run against a *production* server (`pnpm build && pnpm start -p 3100`), not
 * `next dev`: the caching behavior this checks does not exist in dev.
 *
 *   pnpm exec tsx --tsconfig tsconfig.script.json scripts/verify-8-1.ts
 *
 * The interesting half is the last section. Phase 7 shipped
 * `revalidateSite(slug)` → `updateTag(siteCacheTag(slug))` against a tag
 * nothing attached, and task 8.1 attached it. That seam is only genuinely
 * proven by suspending a site *without* revalidating (the page must keep
 * serving, or there is no cache), then revalidating (the page must go dark on
 * the very next request, FR-44).
 *
 * That section needs a Server Action to call `revalidateSite` from, and this
 * app deliberately ships no unauthenticated route that does — one would be a
 * free cache-invalidation endpoint for anyone who found it. So it is skipped
 * unless a throwaway `src/app/tmp-revalidate/page.tsx` is present:
 *
 *   import { revalidateSite } from "@/server/revalidate";
 *
 *   export default function TmpRevalidatePage() {
 *     async function run(formData: FormData) {
 *       "use server";
 *       revalidateSite(String(formData.get("slug")));
 *     }
 *     return (
 *       <form action={run}>
 *         <input name="slug" defaultValue="avelorne" />
 *         <button type="submit">Revalidate</button>
 *       </form>
 *     );
 *   }
 *
 * Add it, rebuild, run this, then delete it again.
 */
import "dotenv/config";

import { prisma } from "@/server/repositories/prisma";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3100";
const LIVE_SLUG = "avelorne";

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
  const response = await fetch(`${BASE}${path}`, { redirect: "manual" });
  return { status: response.status, body: await response.text() };
}

async function revalidateRouteExists(): Promise<boolean> {
  const response = await fetch(`${BASE}/tmp-revalidate`, { redirect: "manual" });
  await response.text();
  return response.status === 200;
}

/** Posts the temporary Server Action page's form. */
async function revalidate(slug: string) {
  const page = await fetch(`${BASE}/tmp-revalidate`);
  const html = await page.text();
  const actionId = /name="\$ACTION_ID_([^"]+)"/.exec(html)?.[1];
  if (actionId === undefined) {
    throw new Error("Could not find the action id — is /tmp-revalidate deployed?");
  }

  const body = new FormData();
  body.set(`$ACTION_ID_${actionId}`, "");
  body.set("slug", slug);

  const response = await fetch(`${BASE}/tmp-revalidate`, { method: "POST", body });
  await response.text();
  return response.status;
}

async function setStatus(slug: string, status: "PUBLISHED" | "SUSPENDED") {
  await prisma.event.update({
    where: { slug },
    data: {
      publicationStatus: status,
      suspendedFromStatus: status === "SUSPENDED" ? "PUBLISHED" : null,
    },
  });
}

async function main() {
  console.log(`\nVerifying the public site route at ${BASE}\n`);

  console.log("A live site (FR-28)");
  {
    const live = await get(`/tedx${LIVE_SLUG}`);
    check("serves 200", live.status === 200, `got ${live.status}`);
    check("renders the template", live.body.includes("aurora"), "no aurora markup");
    check(
      "is not marked noindex",
      !live.body.includes('name="robots" content="noindex"'),
      "a published site must be indexable",
    );
  }

  console.log("\nEvery non-live state is the same response (FR-42)");
  {
    const neverPublished = await get("/tedxdemoevent");
    const nonexistent = await get("/tedxnosuchevent");

    check(
      "never-published slug 404s",
      neverPublished.status === 404,
      `got ${neverPublished.status}`,
    );
    check("unknown slug 404s", nonexistent.status === 404, `got ${nonexistent.status}`);

    // Compared with the requested segment masked out. Next echoes the URL into
    // the RSC flight payload, which is not a leak — it is the address the
    // visitor typed. Everything else must match byte for byte, because any
    // real difference would let someone probe which slugs are taken.
    const mask = (body: string, segment: string) => body.replaceAll(segment, "SEGMENT");
    check(
      "the two are otherwise byte-identical",
      mask(neverPublished.body, "tedxdemoevent") === mask(nonexistent.body, "tedxnosuchevent"),
      "bodies differ beyond the echoed URL — that leaks whether the event exists",
    );
    check(
      "renders the branded page, not the platform 404",
      neverPublished.body.includes("Nothing here"),
      "missing branded copy",
    );
  }

  console.log("\nNon-event paths still 404 (the segment catches everything)");
  {
    const typo = await get("/notanevent");
    check("a non-tedx segment 404s", typo.status === 404, `got ${typo.status}`);
  }

  console.log("\nThe cache is real, and the tag invalidates it (FR-44)");
  if (!(await revalidateRouteExists())) {
    console.log(
      "  – skipped: /tmp-revalidate is not deployed.\n" +
        "    `updateTag` may only be called from a Server Action, and this app has no\n" +
        "    unauthenticated route that calls it — deliberately, since one would be a\n" +
        "    free cache-invalidation endpoint for anybody who found it. To run this\n" +
        "    section, restore the throwaway page documented at the top of this file.",
    );
  } else
    try {
      await setStatus(LIVE_SLUG, "SUSPENDED");

      const stillCached = await get(`/tedx${LIVE_SLUG}`);
      check(
        "suspending without revalidating leaves the cached page serving",
        stillCached.status === 200,
        `got ${stillCached.status} — if this is 404 the route is not actually cached`,
      );

      const actionStatus = await revalidate(LIVE_SLUG);
      check("the revalidate action succeeds", actionStatus === 200, `got ${actionStatus}`);

      const afterRevalidate = await get(`/tedx${LIVE_SLUG}`);
      check(
        "the very next request is dark",
        afterRevalidate.status === 404,
        `got ${afterRevalidate.status} — updateTag did not take effect immediately`,
      );
    } finally {
      await setStatus(LIVE_SLUG, "PUBLISHED");
      await revalidate(LIVE_SLUG);

      const restored = await get(`/tedx${LIVE_SLUG}`);
      check(
        "restoring brings it back the same way",
        restored.status === 200,
        `got ${restored.status}`,
      );
    }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
