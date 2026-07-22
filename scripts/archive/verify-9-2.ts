/**
 * Task 9.2 verification — the report endpoint over real HTTP.
 *
 * Run against a production server (`pnpm build && pnpm start -p 3000`):
 *
 *   pnpm exec tsx --tsconfig tsconfig.script.json scripts/verify-9-2.ts
 *
 * Most of what this checks is *indistinguishability*, which is exactly the
 * property that fails silently: a handler that leaks which slugs exist, or
 * tells a bot its honeypot was caught, looks completely fine from the outside
 * and works perfectly for honest users.
 *
 * Sends its own `x-forwarded-for` so each case gets an isolated rate-limit
 * bucket. That header is client-controlled here because nothing is in front of
 * the dev server — in production the platform overwrites it at the edge, which
 * is the assumption `clientIpFrom` documents.
 *
 * Re-runnable: it clears open rate-limit windows before starting and deletes
 * the reports it filed afterwards. Without the first, a second run inside the
 * hour fails everywhere with 429s from its own previous run; without the
 * second, the admin inbox fills with identical test rows.
 */
import "dotenv/config";

import { prisma } from "@/server/repositories/prisma";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const LIVE_SLUG = "avelorne";
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

let ipCounter = 0;
/** A fresh address per case, so one case's attempts never limit another's. */
function freshIp(): string {
  ipCounter += 1;
  return `203.0.113.${ipCounter}`;
}

async function post(body: unknown, ip: string) {
  const response = await fetch(`${BASE}/api/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
  return { status: response.status, retryAfter: response.headers.get("retry-after") };
}

function report(overrides: Record<string, unknown> = {}) {
  return {
    slug: LIVE_SLUG,
    category: "IMPERSONATION",
    explanation: "This does not look like a licensed TEDx event.",
    reporterEmail: "",
    website: "",
    ...overrides,
  };
}

async function countReports(): Promise<number> {
  return prisma.report.count();
}

async function main() {
  console.log(`\nVerifying the report endpoint at ${BASE}\n`);

  // Rate-limit rows are ephemeral counters, not records (see the Prisma model),
  // so clearing them is safe and is what makes this script re-runnable.
  const cleared = await prisma.rateLimitWindow.deleteMany({});
  if (cleared.count > 0) console.log(`  (cleared ${cleared.count} open rate-limit windows)\n`);

  const startedAt = new Date();
  const before = await countReports();

  console.log("A genuine report (FR-46)");
  {
    const response = await post(report(), freshIp());
    check("is accepted", response.status === 202, `got ${response.status}`);
    check("is persisted", (await countReports()) === before + 1);
  }

  console.log("\nThe honeypot (FR-47)");
  {
    const countBefore = await countReports();
    const response = await post(report({ website: "http://spam.example" }), freshIp());

    check(
      "answers exactly as it does for a real report",
      response.status === 202,
      `got ${response.status} — a different answer teaches the bot to leave the field alone`,
    );
    check(
      "but stores nothing",
      (await countReports()) === countBefore,
      "the honeypot submission was persisted",
    );
  }

  console.log("\nA slug that is not a live site is not distinguishable");
  {
    const countBefore = await countReports();
    const unpublished = await post(report({ slug: UNPUBLISHED_SLUG }), freshIp());
    const nonexistent = await post(report({ slug: "nosuchevent" }), freshIp());

    check(
      "an unpublished slug is accepted",
      unpublished.status === 202,
      `got ${unpublished.status}`,
    );
    check("an unknown slug is accepted", nonexistent.status === 202, `got ${nonexistent.status}`);
    check(
      "both answer identically to a live slug",
      unpublished.status === 202 && nonexistent.status === 202,
      "a differing status makes this endpoint a slug oracle",
    );
    check(
      "and neither is stored",
      (await countReports()) === countBefore,
      "a report was filed against a site nobody can see",
    );
  }

  console.log("\nValidation");
  {
    const short = await post(report({ explanation: "bad" }), freshIp());
    check("refuses an explanation under the minimum", short.status === 400, `got ${short.status}`);

    const badEmail = await post(report({ reporterEmail: "not-an-email" }), freshIp());
    check("refuses a malformed email", badEmail.status === 400, `got ${badEmail.status}`);

    const badCategory = await post(report({ category: "NOT_A_CATEGORY" }), freshIp());
    check("refuses an unknown category", badCategory.status === 400, `got ${badCategory.status}`);

    const malformed = await fetch(`${BASE}/api/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": freshIp() },
      body: "{ not json",
    });
    check("refuses a malformed body", malformed.status === 400, `got ${malformed.status}`);
  }

  console.log("\nThe rate limit (BR-15: 3 per IP per hour per site)");
  {
    const ip = freshIp();
    const statuses: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      statuses.push((await post(report(), ip)).status);
    }

    check(
      "allows exactly three",
      statuses.slice(0, 3).every((status) => status === 202),
      `got ${statuses.join(", ")}`,
    );
    check("refuses the fourth", statuses[3] === 429, `got ${String(statuses[3])}`);

    const limited = await post(report(), ip);
    check("and keeps refusing", limited.status === 429, `got ${limited.status}`);
    check(
      "with a Retry-After the client can act on",
      limited.retryAfter !== null && Number(limited.retryAfter) > 0,
      `got ${String(limited.retryAfter)}`,
    );
  }

  console.log("\nThe limit is per site and per address, not global");
  {
    const sharedIp = freshIp();
    for (let i = 0; i < 3; i += 1) await post(report(), sharedIp);

    const otherSite = await post(report({ slug: UNPUBLISHED_SLUG }), sharedIp);
    check(
      "the same address can still report a different site",
      otherSite.status === 202,
      `got ${otherSite.status} — the key is not scoped per site`,
    );

    const otherIp = await post(report(), freshIp());
    check(
      "a different address is unaffected",
      otherIp.status === 202,
      `got ${otherIp.status} — one reporter can silence everyone`,
    );
  }

  console.log("\nThe raw IP is never stored");
  {
    const rows = await prisma.report.findMany({ select: { reporterIpHash: true }, take: 20 });
    check(
      "every stored hash is an HMAC, not an address",
      rows.every((row) => /^[0-9a-f]{64}$/.test(row.reporterIpHash)),
      "found something that is not a 64-char hex digest",
    );
    check(
      "and no row contains a literal test address",
      rows.every((row) => !row.reporterIpHash.includes("203.0.113")),
    );
  }

  // Leave the database as we found it. The reports filed above are test
  // fixtures, and task 9.3's inbox should be built against real ones.
  const removed = await prisma.report.deleteMany({ where: { createdAt: { gte: startedAt } } });
  await prisma.rateLimitWindow.deleteMany({});
  console.log(`\nCleaned up ${removed.count} test reports.`);

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
