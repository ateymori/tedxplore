import { NextResponse } from "next/server";

import { serverEnv } from "@/config/env";
import { sweepExpiredRateLimits } from "@/server/adapters/rate-limit";
import { captureException, logger } from "@/server/logger";

/**
 * Periodic maintenance sweep (task 10.4), driven by Vercel Cron.
 *
 * Reclaims expired `RateLimitWindow` rows. The rate limiter already reaps
 * opportunistically on write (tech-stack decision 5), but a quiet period with
 * no reports leaves closed windows sitting until the next one; this is the
 * backstop. It deliberately does **not** run the orphaned-media sweep — that
 * one deletes Cloudinary assets and is a manually run, dry-run-by-default
 * script (`scripts/cleanup-orphaned-media.ts`), not something to fire
 * unattended on a schedule.
 *
 * ## Authorization
 *
 * Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. The check is
 * fail-closed in production: with no `CRON_SECRET` configured the route refuses
 * everyone (so it is never an open "mutate the database" endpoint), and only in
 * development does it allow an unauthenticated call for local testing.
 */
function isAuthorized(request: Request): boolean {
  const secret = serverEnv.CRON_SECRET;
  if (secret !== undefined) {
    return request.headers.get("authorization") === `Bearer ${secret}`;
  }
  return process.env.NODE_ENV !== "production";
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const swept = await sweepExpiredRateLimits();
    logger.info("cron.ratelimit_sweep", { swept });
    return NextResponse.json({ ok: true, swept });
  } catch (error) {
    captureException(error, { scope: "cron", job: "ratelimit-sweep" });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
