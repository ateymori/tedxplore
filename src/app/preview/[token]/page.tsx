import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DraftSite } from "@/components/preview/draft-site";
import { loadTokenPreview } from "@/server/services/preview-link-service";

/**
 * The tokenized draft preview (FR-25, task 6.2).
 *
 * The same draft the owner sees at `/preview/draft/[eventId]`, shown to
 * whoever holds the link — a teammate, a speaker checking their own bio —
 * with no account and no session. The token is the entire credential, which is
 * why it is 256 bits (`lib/preview-token.ts`) and why this route reads nothing
 * else about the requester.
 *
 * Read-only by construction rather than by permission: the page renders the
 * public template and links to no mutation, and every editing surface sits
 * behind `/dashboard`, which the guards gate independently.
 */

/**
 * There is deliberately no caching directive on this route.
 *
 * FR-26 requires revocation to take effect *instantly*, and a draft is being
 * edited continuously, so a cached render would show a revoked link a live page
 * and an unrevoked one yesterday's copy. Before Cache Components this had to be
 * said out loud — `export const dynamic = "force-dynamic"` — because the route
 * reads no cookies and would otherwise have been served from the full route
 * cache forever.
 *
 * Under Cache Components uncached is the default: nothing renders from a cache
 * unless it sits inside a `use cache` scope, and `loadPreview` does not. The
 * guarantee survives the removal of that export, but it now rests on a default
 * rather than a declaration — so the rule for this file is that **no
 * `use cache` may ever wrap the token lookup**, however tempting that
 * per-request database read starts to look.
 *
 * ## The 404 status was lost here, and it is not coming back cheaply
 *
 * `notFound()` below still renders this segment's branded `not-found.tsx`, but
 * the response is now **200, not 404**. Once a Suspense fallback renders — and
 * `preview/loading.tsx` is one — the server has already committed to `200 OK`
 * and cannot revise the status; Next injects `<meta name="robots" content=
 * "noindex">` instead. Getting the real status back would mean resolving the
 * token before any boundary, which Cache Components refuses because that is an
 * uncached database read (both `connection()` and dropping the boundary were
 * tried; both fail the build with `blocking-route`).
 *
 * This was accepted deliberately rather than overlooked. What FR-26 actually
 * protects — the draft ceasing to be served on the very next request — holds,
 * and FR-27's noindex holds twice over (this page's metadata and the
 * `X-Robots-Tag` header from `next.config.ts`). What is lost is the status
 * line, which link checkers read and people do not.
 *
 * `scripts/verify-8-0.ts` pins all of this, including asserting the 200, so a
 * future Next.js that makes the 404 reachable again will fail that script
 * loudly rather than leaving this comment quietly wrong.
 */

/**
 * Resolving happens twice per request — once for the title, once for the body
 * — so it is wrapped in React's `cache` and costs one query. Same pattern as
 * `getCurrentUser` in the auth guards.
 */
const loadPreview = cache(loadTokenPreview);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const result = await loadPreview(token);

  return {
    // FR-27, belt and braces: the meta tag here, the `X-Robots-Tag` header in
    // `next.config.ts`. A crawler that never parses the HTML still sees one,
    // and the sitemap (task 8.2) lists published sites only.
    robots: { index: false, follow: false },
    title: result.ok ? `${result.value.displayName} (preview)` : "Preview link",
  };
}

export default async function TokenPreviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await loadPreview(token);

  // Renders this segment's own `not-found.tsx` — a branded page *and* a real
  // 404. Unknown, malformed, revoked, and deleted all land there, and the
  // service makes them indistinguishable on purpose (see `loadTokenPreview`).
  if (!result.ok) notFound();

  const { templateId, draft } = result.value;

  return (
    <>
      {/*
        The one deviation from the published site, and it earns its place: the
        recipient did not choose to open a preview the way the owner did, and
        an unpublished draft that looks exactly like a live site invites them
        to share the URL onward or to report a "typo" that is already fixed.
        Small, fixed so it shifts nothing in the layout being reviewed, and
        `print:hidden` so a printed copy is the site alone.
      */}
      <div className="fixed top-4 left-4 z-50 print:hidden">
        <p className="rounded-full bg-neutral-900/90 px-4 py-2 text-sm font-medium text-white shadow-lg ring-1 ring-white/20 backdrop-blur">
          Draft preview — not published
        </p>
      </div>

      <DraftSite templateId={templateId} draft={draft} />
    </>
  );
}
