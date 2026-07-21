import { NextResponse } from "next/server";

import { reportSubmissionSchema } from "@/lib/validation/report";
import { clientIpFrom } from "@/lib/client-ip";
import { submitReport } from "@/server/services/report-service";

/**
 * Report submission (FR-45..FR-47, task 9.2).
 *
 * A Route Handler rather than a Server Action, per the conventions: this is a
 * public, unauthenticated endpoint, and Server Actions are for the editor's
 * authenticated mutations. It is also the only write path in the product
 * reachable without a session, which is why the rate limiting sits behind it
 * rather than beside it.
 *
 * Uncached by construction — a POST handler is never prerendered — so nothing
 * here interacts with the `use cache` entry serving the page the form is on
 * (task 8.1).
 *
 * ## The response says almost nothing, on purpose
 *
 * `202 Accepted` for anything the service accepted, which includes reports it
 * deliberately discarded (a filled honeypot, a slug that is not a live site).
 * `submitReport`'s comment has the full reasoning; the short version is that a
 * distinguishable response would turn this into a bot tutorial and a slug
 * oracle. The two exceptions are a malformed body (a bug in our own form, not
 * a thing an attacker learns anything from) and the rate limit, which the
 * reporter genuinely needs to be told about.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const parsed = reportSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    // Field-level messages are deliberately not echoed. The form validates
    // against the same rules before submitting, so anything reaching here is
    // either our bug or someone hand-crafting requests; neither is helped by a
    // field map, and the second is helped a little too much by one.
    return NextResponse.json({ error: "That report could not be submitted." }, { status: 400 });
  }

  const outcome = await submitReport(parsed.data, clientIpFrom(request.headers));

  if (outcome.type === "RATE_LIMITED") {
    return NextResponse.json(
      { error: "Too many reports for this site. Please try again later." },
      {
        status: 429,
        // Standard, and the number a well-behaved client actually reads.
        headers: {
          "Retry-After": String(
            Math.max(1, Math.ceil((outcome.resetAt.getTime() - Date.now()) / 1000)),
          ),
        },
      },
    );
  }

  return NextResponse.json({ ok: true }, { status: 202 });
}
