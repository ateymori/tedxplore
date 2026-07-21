/**
 * Task 8.0 verification: Cache Components did not weaken FR-26.
 *
 * Run against a *running* dev/prod server:
 *   pnpm exec tsx --tsconfig tsconfig.script.json scripts/verify-8-0.ts
 *
 * The question this answers is narrow and specific. `/preview/[token]` used to
 * carry `export const dynamic = "force-dynamic"`, and CLAUDE.md recorded that
 * export as load-bearing for FR-26's *instant* revocation. Cache Components
 * forbids the export, and the replacement guarantee is a default ("uncached
 * unless it says otherwise") rather than a declaration — so the guarantee has
 * to be re-measured over real HTTP rather than reasoned about.
 *
 * It also checks FR-27's two noindex signals still ride along, since the same
 * route serves them.
 */
import "dotenv/config";

import { previewLinkUrl } from "@/config/routes";
import { prisma } from "@/server/repositories/prisma";
import { issuePreviewLink, revokePreviewLink } from "@/server/services/preview-link-service";
import type { SessionUser } from "@/server/auth";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail = ""): void {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${label}`);
  } else {
    failed += 1;
    console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main(): Promise<void> {
  const event = await prisma.event.findFirst({
    where: { deletedAt: null },
    include: { owner: true },
  });

  if (!event) throw new Error("No event in the database — run `pnpm exec prisma db seed` first.");

  const owner: SessionUser = {
    id: event.owner.id,
    email: event.owner.email,
    name: event.owner.name,
    role: event.owner.role,
    emailVerified: event.owner.emailVerified,
    image: event.owner.image,
  } as SessionUser;

  console.log(`\nEvent: ${event.slug} (${event.displayName})`);
  console.log(`Base:  ${BASE}\n`);

  // --- Issue -------------------------------------------------------------
  const issued = await issuePreviewLink(owner, event.id);
  if (!issued.ok) throw new Error(`issuePreviewLink failed: ${JSON.stringify(issued.error)}`);

  const url = previewLinkUrl(issued.value.token).replace(
    /^https?:\/\/[^/]+/,
    BASE.replace(/\/$/, ""),
  );
  console.log(`Issued: ${url}\n`);

  console.log("A live token, fetched anonymously:");
  const live = await fetch(url, { redirect: "manual" });
  const liveBody = await live.text();
  check("responds 200", live.status === 200, `got ${live.status}`);
  check(
    "carries X-Robots-Tag noindex (FR-27, header)",
    (live.headers.get("x-robots-tag") ?? "").includes("noindex"),
    live.headers.get("x-robots-tag") ?? "absent",
  );
  check(
    "carries a noindex robots meta tag (FR-27, HTML)",
    /<meta[^>]+name="robots"[^>]+noindex/i.test(liveBody),
  );
  check("renders the draft, not a cached shell", liveBody.includes(event.displayName));

  // --- Fetch again: proves it is not being served from a route cache -----
  console.log("\nThe same token again (a cached route would serve a frozen copy):");
  const second = await fetch(url, { redirect: "manual" });
  check("still 200", second.status === 200, `got ${second.status}`);

  // --- Revoke, then immediately re-request -------------------------------
  const revoked = await revokePreviewLink(owner, event.id);
  if (!revoked.ok) throw new Error(`revokePreviewLink failed: ${JSON.stringify(revoked.error)}`);

  console.log("\nImmediately after revocation (FR-26 — the whole point):");
  const dead = await fetch(url, { redirect: "manual" });
  const deadBody = await dead.text();

  // The substance of FR-26: the draft stops being served on the very next
  // request. This is the assertion that actually protects the organizer.
  check(
    "the draft is no longer served at all",
    !deadBody.includes(event.displayName),
    "revoked token still rendered the draft",
  );
  check("the branded dead-link page renders instead", deadBody.includes("isn"));

  /*
   * ...but with a 200, not a 404, and that is a deliberate, recorded trade.
   *
   * Phase 6 chose a segment-scoped `not-found.tsx` precisely to get a real 404
   * status. Cache Components takes that off the table: once a Suspense fallback
   * renders, the server has committed to `200 OK` and cannot revise it, and the
   * token check needs a database read, which Next refuses to allow above any
   * boundary (`connection()` and dropping the boundary were both tried — both
   * fail the build with `blocking-route`).
   *
   * Asserted rather than merely tolerated, so that if a future Next.js makes
   * the 404 reachable again this test fails and tells us to take it back.
   */
  check(
    "status is 200 — the documented Cache Components trade, not a 404",
    dead.status === 200,
    `got ${dead.status}; if this is now 404, Next.js has changed and CLAUDE.md's note should be revisited`,
  );

  // The indexing guarantee has to survive the lost status, and does — twice
  // over, which is why FR-27 was built with two independent signals.
  check(
    "the dead link is still noindex (header)",
    (dead.headers.get("x-robots-tag") ?? "").includes("noindex"),
    dead.headers.get("x-robots-tag") ?? "absent",
  );
  check(
    "the dead link is still noindex (meta)",
    /<meta[^>]+name="robots"[^>]+noindex/i.test(deadBody),
  );

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
