import Link from "next/link";
import { Link2Off } from "lucide-react";

import { HOME_PATH } from "@/config/routes";
import { SITE_NAME } from "@/config/site";

/**
 * The branded dead end for a preview link that isn't active (task 6.2).
 *
 * A `not-found.tsx` scoped to this segment rather than a component the page
 * returns. The platform's own 404 would get the message wrong — it tells the
 * visitor they typed something incorrectly, which is untrue and gives them
 * nothing to do — so the branded copy is the point of this file.
 *
 * It was *also* chosen, in Phase 6, because a boundary yields a real 404 where
 * a returned component is "a 200 saying gone in prose". Task 8.0 took that half
 * away: under Cache Components this route streams behind a Suspense fallback,
 * the status is committed to 200 before `notFound()` fires, and Next injects a
 * `noindex` meta tag in lieu of the status. The reasoning is recorded in full
 * on `page.tsx`; the short version is that the status is no longer obtainable
 * without a database read in the proxy, and the branded copy — the reason this
 * file exists — is unaffected.
 *
 * It says nothing about whether the event exists. `loadTokenPreview` refuses to
 * distinguish unknown, malformed, revoked, and deleted, and this page must not
 * leak by implication what the service declined to state.
 */
export default function PreviewLinkNotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <Link2Off className="size-10 text-muted-foreground" aria-hidden />
      <h1 className="text-3xl font-semibold tracking-tight">
        This preview link isn&rsquo;t active
      </h1>
      <p className="max-w-md text-lg text-muted-foreground">
        Preview links can be turned off or replaced by the event organizer. Ask them for a fresh
        link, and it will work right away.
      </p>
      <Link href={HOME_PATH} className="text-sm font-medium underline underline-offset-4">
        Go to {SITE_NAME}
      </Link>
    </main>
  );
}
