/**
 * Task 9.4 verification — rate limiting on preview-token guessing and auth.
 *
 * Run against a production server (`pnpm build && pnpm start -p 3000`):
 *
 *   pnpm exec tsx --tsconfig tsconfig.script.json scripts/verify-9-4.ts
 *
 * Two independent limiters:
 *   - Preview guessing → our `RateLimiter` (count-on-failure). Checked over
 *     HTTP against `/preview/{guess}`, and directly against the table to prove
 *     a *valid* link does not consume the budget.
 *   - Auth endpoints → Better Auth's own limiter, database-backed. Checked by
 *     spraying `/api/auth/sign-in/email` until it returns 429.
 *
 * Sends its own `x-forwarded-for` per case so buckets stay isolated, and clears
 * both rate-limit tables at the start so it is re-runnable inside the window.
 */
import "dotenv/config";

import { PREVIEW_GUESS_MAX_PER_HOUR } from "@/config/limits";
import { generatePreviewToken } from "@/lib/preview-token";
import { prisma } from "@/server/repositories/prisma";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";

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
function freshIp(): string {
  ipCounter += 1;
  return `198.51.100.${ipCounter}`;
}

/**
 * A *shaped* but almost-certainly-unregistered token — the shape of a real
 * guess. It has to pass `isPreviewTokenShaped` (43 base64url chars) or the
 * route rejects it for free before the rate limiter ever sees it, which is the
 * whole point of that shape check. A random one is unregistered with
 * overwhelming probability.
 */
function fakeToken(): string {
  return generatePreviewToken();
}

async function getPreview(token: string, ip: string) {
  const response = await fetch(`${BASE}/preview/${token}`, {
    headers: { "x-forwarded-for": ip },
    redirect: "manual",
  });
  await response.text();
  return response.status;
}

async function main() {
  console.log(`\nVerifying rate limiting at ${BASE}\n`);

  await prisma.rateLimitWindow.deleteMany({});
  await prisma.rateLimit.deleteMany({});

  console.log("Preview-token guessing (our adapter, count-on-failure)");
  {
    const ip = freshIp();

    // Spray more guesses than the budget. Each is a shaped-but-invalid token,
    // i.e. a miss, so each consumes one unit.
    for (let i = 0; i < PREVIEW_GUESS_MAX_PER_HOUR + 5; i += 1) {
      await getPreview(fakeToken(), ip);
    }

    const key = `preview-guess:${ip}`;
    const window = await prisma.rateLimitWindow.findUnique({ where: { key } });

    check("a window row was opened for the guesser", window !== null);
    check(
      "the count stops climbing at the budget",
      window !== null && window.count <= PREVIEW_GUESS_MAX_PER_HOUR + 1,
      `count reached ${window?.count} — peek is not short-circuiting the query`,
    );
    check(
      "and every guess still returns the same status (leaks nothing)",
      (await getPreview(fakeToken(), ip)) === (await getPreview(fakeToken(), freshIp())),
      "a rate-limited guess is distinguishable from a fresh miss",
    );
  }

  console.log("\nA valid link never spends the guessing budget");
  {
    // Issue a real token straight through the repository, then view it.
    const event = await prisma.event.findFirst({
      where: { deletedAt: null },
      select: { id: true },
    });
    if (event === null) {
      check("(skipped — no event in the database to attach a token to)", true);
    } else {
      const token = generatePreviewToken();
      await prisma.previewToken.updateMany({
        where: { eventId: event.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await prisma.previewToken.create({ data: { eventId: event.id, token } });

      const ip = freshIp();
      for (let i = 0; i < 5; i += 1) await getPreview(token, ip);

      const window = await prisma.rateLimitWindow.findUnique({
        where: { key: `preview-guess:${ip}` },
      });
      check(
        "five views of a valid link consume nothing",
        window === null,
        `a window was opened (count ${window?.count}) — valid views are being counted`,
      );

      await prisma.previewToken.deleteMany({ where: { token } });
    }
  }

  console.log("\nAuth endpoints (Better Auth's limiter, database-backed)");
  {
    const ip = freshIp();
    const statuses: number[] = [];

    // The sign-in rule is 5/minute; the 6th should be refused. Use a bogus
    // account so nothing actually authenticates — a rejected credential and a
    // rate-limited request are different failures, and only the second is 429.
    for (let i = 0; i < 7; i += 1) {
      const response = await fetch(`${BASE}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
        body: JSON.stringify({ email: `nobody-${ip}@verify.test`, password: "wrongpassword" }),
      });
      await response.text();
      statuses.push(response.status);
    }

    check(
      "the first few attempts are not rate-limited",
      statuses.slice(0, 5).every((status) => status !== 429),
      `got ${statuses.join(", ")}`,
    );
    check(
      "a burst past the sign-in rule is refused with 429",
      statuses.includes(429),
      `never saw a 429 — got ${statuses.join(", ")}`,
    );
    check(
      "Better Auth persisted the counter to its own table",
      (await prisma.rateLimit.count()) > 0,
      "the rateLimit table is empty — storage is not 'database'",
    );
  }

  console.log("\nThe two limiters use separate tables");
  {
    const ours = await prisma.rateLimitWindow.count();
    const theirs = await prisma.rateLimit.count();
    check("our RateLimitWindow has rows", ours > 0);
    check("Better Auth's rateLimit has rows", theirs > 0);
  }

  // Leave both tables clean.
  await prisma.rateLimitWindow.deleteMany({});
  await prisma.rateLimit.deleteMany({});

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
