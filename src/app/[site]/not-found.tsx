import Link from "next/link";

import { HOME_PATH } from "@/config/routes";
import { SITE_NAME } from "@/config/site";

/**
 * The branded dead end for a public event URL (FR-42, task 8.1).
 *
 * Reached for every non-live state — suspended, unpublished, soft-deleted,
 * never published — and for a slug nobody has ever claimed. The copy has to be
 * identical across all of them, because distinguishing them is the leak FR-42
 * exists to prevent: "this site has been suspended" tells a stranger both that
 * the event exists and that an admin acted against it.
 *
 * It is also, by construction, the 404 for any unmatched single-segment path:
 * `[site]` is a top-level dynamic segment, so `/typo` renders this rather than
 * the root `not-found.tsx`. The wording therefore leads with the general case
 * and mentions event sites second — a visitor who mistyped a dashboard URL
 * should not be told something confusing about publication.
 *
 * Unlike `/preview/[token]`, this one really is a 404. The route resolves its
 * slug before any Suspense boundary (see `page.tsx` on `generateStaticParams`),
 * so the status is still ours to set.
 */
export default function SiteNotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">Nothing here</h1>
      <p className="max-w-md text-lg text-muted-foreground">
        There&rsquo;s no page at this address. If you were looking for an event site, it may not be
        published yet — check the link with the organizers.
      </p>
      <Link href={HOME_PATH} className="text-sm font-medium underline underline-offset-4">
        Go to {SITE_NAME}
      </Link>
    </main>
  );
}
