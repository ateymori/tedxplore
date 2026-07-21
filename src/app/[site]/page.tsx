import { cacheLife, cacheTag } from "next/cache";
import { notFound } from "next/navigation";

import { parseTedxSegment, siteCacheTag, tedxSiteSegment } from "@/config/site";
import type { LiveSite } from "@/server/services/site-service";
import { listPublishedSiteSlugs, loadLiveSite } from "@/server/services/site-service";
import { findTemplate } from "@/templates/registry";

/**
 * The public event site (FR-28, FR-42, task 8.1).
 *
 * `tedxplore.com/tedxmcgillu` — a path on this application, served from this
 * deployment, not a subdomain. The App Router cannot express `tedx[slug]` as a
 * folder (partial dynamic segments are unsupported, verified in Phase 1), so
 * this segment receives `tedxmcgillu` whole and splits the prefix off itself
 * with `parseTedxSegment`.
 *
 * Being a top-level dynamic segment, it also catches every unmatched
 * single-segment path — `/typo` lands here too. Those get `notFound()`, which
 * is why `not-found.tsx` beside this file has to read sensibly for a visitor
 * who was never looking for an event at all.
 *
 * ## The caching contract (deferred here from task 8.0, deliberately)
 *
 * Phase 7 shipped the invalidation half of this cache — `revalidateSite(slug)`
 * → `updateTag(siteCacheTag(slug))` from approve, unpublish, suspend, and
 * restore — against a tag nothing attached yet. `getLiveSite` below is the
 * other half. Until this file existed those four calls were inert no-ops; from
 * here they are the mechanism by which a suspension takes a site offline on the
 * *next* request rather than whenever a cache felt like expiring (FR-44).
 *
 * The tag string is built by `siteCacheTag` in `config/site.ts` at both ends
 * precisely because a typo here would not fail — it would silently keep serving
 * a suspended site until the next deploy.
 *
 * ## Why `generateStaticParams`, when the list is always out of date
 *
 * Not for the prerendering, which is a nice-to-have. Under Cache Components a
 * dynamic segment *without* `generateStaticParams` makes `params` runtime data,
 * which must be read below a `<Suspense>` boundary — and once a fallback
 * renders, the response has already committed to `200 OK`. That is exactly what
 * cost `/preview/[token]` its 404 in task 8.0. Here the status is load-bearing:
 * FR-42 wants a real 404 for a site that isn't live, and 8.2 is about to make
 * search engines' reading of these URLs a product concern. Declaring
 * `generateStaticParams` makes `params` build-time data, so the resolution
 * below happens before any boundary and `notFound()` still sets the status.
 *
 * The list being stale is harmless: a slug it omits is rendered on first
 * request and written to disk from then on. See `listPublishedSiteSlugs`.
 */

export async function generateStaticParams() {
  const slugs = await listPublishedSlugsOrNone();

  // Cache Components rejects an empty array (`empty-generate-static-params`):
  // it needs at least one param to prerender, both to produce a shell and to
  // validate at build time that this route reads no runtime API. A brand-new
  // deployment has no published events, so a placeholder stands in.
  //
  // `plore` is on the reserved blocklist (BR-4), so no event can ever hold it
  // and this path can never collide with a real site. It resolves to `null`
  // below and prerenders the 404 — which does mean the render path itself goes
  // unvalidated on a build with nothing published, the known cost the Next.js
  // docs call out for placeholder params.
  if (slugs.length === 0) return [{ site: tedxSiteSegment("plore") }];

  return slugs.map((slug) => ({ site: tedxSiteSegment(slug) }));
}

/**
 * `generateStaticParams` runs during `next build`, and the build must not
 * require a reachable database — CI builds with no `DATABASE_URL` at all (see
 * `.github/workflows/ci.yml`, which supplies only a placeholder auth secret).
 *
 * Failing soft costs nothing real: an unreachable database here means zero
 * prerendered sites, and every site is then rendered on its first request
 * exactly as a newly published one already is. Failing hard would mean a
 * database blip could block a deploy that has nothing to do with the database.
 */
async function listPublishedSlugsOrNone(): Promise<string[]> {
  try {
    return await listPublishedSiteSlugs();
  } catch (error) {
    console.warn(
      "[site] Could not list published slugs for prerendering; continuing with none.",
      error,
    );
    return [];
  }
}

/**
 * The cached read, tagged per site.
 *
 * `cacheLife("days")` rather than a shorter profile because the content of a
 * live site changes only when an admin approves something, and that path
 * updates the tag — so the revalidate interval is a backstop against a missed
 * invalidation, not the primary freshness mechanism. It also bounds how long
 * the footer's copyright year can lag, which is the one thing on the page
 * derived from render time.
 *
 * Returns data, not markup, so that `notFound()` can be thrown by the caller:
 * a throw is not a value a cache entry can hold (task 8.0, same reason the
 * template Live Preview checks the registry outside its cached component).
 *
 * `renderedAt` is captured here rather than in the page because Next.js
 * refuses `new Date()` in a prerendered Server Component outright — reading the
 * clock while producing a page that will be served to many people at other
 * times is a bug in the general case, and the framework says so
 * (`next-prerender-current-time`). Inside a cache entry it is well defined: the
 * moment this entry was produced. That is precisely what Aurora's footer
 * documents its copyright year as being, and the only thing on the page that
 * uses it — the countdown reads the visitor's own clock client-side.
 */
async function getLiveSite(slug: string): Promise<CachedSite | null> {
  "use cache";
  cacheLife("days");
  cacheTag(siteCacheTag(slug));

  const live = await loadLiveSite(slug);
  return live === null ? null : { ...live, renderedAt: new Date() };
}

type CachedSite = LiveSite & { renderedAt: Date };

export default async function PublicSitePage({ params }: PageProps<"/[site]">) {
  const { site } = await params;

  // Not an event URL at all — `/dashboard` and friends are static routes and
  // never reach here, so this is an ordinary mistyped path.
  const slug = parseTedxSegment(site);
  if (slug === null) notFound();

  // One outcome for suspended, unpublished, deleted, never-published, and
  // nonexistent (FR-42). `loadLiveSite` refuses to distinguish them and this
  // page must not leak by implication what the service declined to state.
  const live = await getLiveSite(slug);
  if (live === null) notFound();

  const template = findTemplate(live.templateId);
  // Only reachable if a template were dropped from the registry while
  // published events still referenced it — a deployment mistake, not input.
  if (template === null) notFound();

  const { Renderer } = template;

  // `now` is passed rather than read inside the template (Phase 4). On this
  // route it is the time of the render that produced the cached page — see
  // `getLiveSite`, which is where it has to be captured.
  return <Renderer content={live.content} mode="public" now={live.renderedAt} />;
}
