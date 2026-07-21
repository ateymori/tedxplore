import type { MetadataRoute } from "next";
import { cacheLife, cacheTag } from "next/cache";

import { HOME_PATH } from "@/config/routes";
import { APP_URL, SITEMAP_CACHE_TAG, tedxSitePath } from "@/config/site";
import { listPublishedSites } from "@/server/services/site-service";

/**
 * The sitemap (task 8.2).
 *
 * Lists the marketing homepage and every live event site — nothing else. The
 * omissions are the design:
 *
 *   - **Non-live sites are absent, not merely disallowed.** Suspended,
 *     unpublished, and never-published slugs never appear, so there is no
 *     platform-published list of URLs to probe. FR-42's indistinguishability
 *     would be pointless if the sitemap enumerated them.
 *   - **Preview links are absent.** They are secret by construction, and are
 *     `noindex` twice over besides (`robots.ts`, plus the `X-Robots-Tag`
 *     header from `next.config.ts`).
 *   - **The dashboard and admin area are absent.** They are behind a session
 *     and have nothing to offer a crawler.
 *
 * `lastModified` is the live snapshot's creation time — when the page actually
 * changed for the public — not the event's `updatedAt`, which moves on every
 * autosave of a draft that may never be submitted.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const sites = await listPublishedSitesOrNone();

  return [
    {
      url: absolute(HOME_PATH),
      changeFrequency: "monthly",
      priority: 1,
    },
    ...sites.map((site) => ({
      url: absolute(tedxSitePath(site.slug)),
      lastModified: site.lastModified,
      // An event site changes when its organizers publish a revision, which is
      // occasional and bursty rather than periodic. "weekly" is the honest
      // middle: often enough that a re-crawl follows an approval reasonably
      // soon, rarely enough not to claim churn that isn't there.
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}

/**
 * Cached and tagged, so approve, unpublish, suspend, and restore all refresh
 * the sitemap through the same `revalidateSite` call that refreshes the site
 * itself (`server/revalidate.ts`) — there is no separate invalidation for a
 * future publishing action to forget.
 *
 * The one-hour revalidate is a backstop for anything that changes this set
 * without going through those actions. A site is reachable and indexable the
 * instant it is approved regardless; a sitemap is a hint to crawlers, not a
 * gate, so lag here costs nothing.
 */
async function listPublishedSitesOrNone() {
  "use cache";
  cacheLife("hours");
  cacheTag(SITEMAP_CACHE_TAG);

  try {
    return await listPublishedSites();
  } catch (error) {
    // `next build` renders this route, and the build must not require a
    // reachable database — CI builds with no `DATABASE_URL` at all. An empty
    // sitemap is a far better build artifact than a failed deploy.
    console.warn("[sitemap] Could not list published sites; serving the homepage only.", error);
    return [];
  }
}

function absolute(path: string): string {
  return new URL(path, APP_URL).toString();
}
