import "server-only";

import type { LiveSiteRow, LiveSiteSummary } from "@/server/repositories/snapshot-repository";
import { findLiveSiteBySlug, listLiveSites } from "@/server/repositories/snapshot-repository";

/**
 * The public event site (FR-28, FR-42, task 8.1).
 *
 * The only service in the codebase with no authorization step, and the absence
 * is the point: a published site is public, and asking who the visitor is
 * would make the route session-dependent — which under Cache Components is the
 * difference between a page that prerenders and one that cannot be cached at
 * all. Nothing here reads a cookie, a header, or a session.
 *
 * ## Why this returns `null` rather than a `Result`
 *
 * Every other service returns a discriminated `Result` because its callers
 * have to tell "not found" from "not yours" from "not in that state" and
 * render something different for each. This one deliberately cannot: FR-42
 * requires suspended, unpublished, deleted, and never-published slugs to be
 * *indistinguishable* from a slug nobody has ever claimed. A `Result` here
 * would offer an error variant to branch on, and the first branch anyone added
 * would leak — "this event is suspended" tells a stranger both that the event
 * exists and that an admin acted against it.
 *
 * One outcome, one representation. The repository's `where` clause does the
 * collapsing, so it cannot be undone downstream.
 */
export type LiveSite = LiveSiteRow;

export async function loadLiveSite(slug: string): Promise<LiveSite | null> {
  return findLiveSiteBySlug(slug);
}

/**
 * Every live site — the route's prerender list (8.1) and the sitemap (8.2).
 *
 * For the route this is not an exhaustive list of what gets served: a site
 * published after the build is rendered on its first request and written to
 * disk from then on, so it is a warm-start optimization rather than a routing
 * rule. That is also why there is no `dynamicParams = false` on the route —
 * turning it into a routing rule would mean every newly approved event 404s
 * until the next deploy, precisely the failure `updateTag` exists to prevent.
 *
 * For the sitemap it *is* exhaustive, and it is the only place the platform
 * enumerates event sites publicly. Anything not live is absent, which is what
 * keeps unpublished and suspended URLs out of search results (FR-42) rather
 * than merely un-followed.
 */
export type PublishedSite = LiveSiteSummary;

export async function listPublishedSites(): Promise<PublishedSite[]> {
  return listLiveSites();
}
