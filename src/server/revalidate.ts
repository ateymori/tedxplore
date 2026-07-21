import "server-only";
import { updateTag } from "next/cache";

import { SITEMAP_CACHE_TAG, siteCacheTag } from "@/config/site";

/**
 * Public-site cache invalidation.
 *
 * ## Why this is not in the services
 *
 * Approve, unpublish, restore, and suspend all change what the world sees, and
 * it would be tempting to revalidate inside the service that performs them —
 * one place, impossible to forget. It lives here instead for two reasons:
 *
 *   1. `next/cache` only works inside a request context. The services are
 *      deliberately runnable from a plain Node script (that is how every phase
 *      has been verified against the real database), and an import that throws
 *      outside an RSC graph would end that.
 *   2. Cache invalidation is a fact about *this deployment's rendering*, not
 *      about the domain. A service returning "the site at this slug changed" is
 *      the honest boundary; what a Next.js cache does about it is transport.
 *
 * Every publishing action therefore ends in a `revalidateSite(slug)` call, and
 * the services return the slug specifically so the action can make it.
 *
 * ## Why a tag and not a path
 *
 * Phase 8 renders `/tedx{slug}` statically and will attach `siteCacheTag(slug)`
 * to its data reads. Tagging means this module never has to know the route's
 * shape — if the public site later grows a second cached entry point, it is
 * covered without touching any of the four actions that call this.
 *
 * Revalidating a tag nothing has attached yet is a no-op, so this is safe to
 * ship ahead of Phase 8 — which is the point: shipping it now means the
 * approval flow does not need revisiting once the public route exists.
 *
 * ## Why `updateTag` and not `revalidateTag`
 *
 * Next 16 splits these. `revalidateTag` expires the entry but lets the *next*
 * request still be served the stale copy while the fresh one is built;
 * `updateTag` makes the next request wait for fresh data. For a suspension that
 * difference is the requirement: FR-44 says suspension takes the site offline
 * *immediately*, and one more visitor served a suspended page from cache is
 * exactly the failure an admin pressed the button to prevent. Approval gets the
 * same treatment for the same reason in reverse — an organizer refreshing after
 * the "you're live" email must not get a 404.
 *
 * The cost is that `updateTag` may only be called from a Server Action. Every
 * caller here is one; a Route Handler that ever needs this would have to use
 * `revalidateTag(tag, profile)` and accept the staleness.
 */
export function revalidateSite(slug: string): void {
  updateTag(siteCacheTag(slug));

  // The sitemap too (task 8.2). Every caller of this function is an action
  // that moves a site into or out of the published set — approve, unpublish,
  // suspend, restore — which is exactly when the sitemap's *contents* change,
  // not just one page's. Doing it here rather than at the four call sites
  // means a fifth publishing action cannot forget it.
  updateTag(SITEMAP_CACHE_TAG);
}
