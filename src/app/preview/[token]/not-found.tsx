import Link from "next/link";
import { Link2Off } from "lucide-react";

import { HOME_PATH } from "@/config/routes";
import { SITE_NAME } from "@/config/site";

/**
 * The branded dead end for a preview link that isn't active (task 6.2).
 *
 * A `not-found.tsx` scoped to this segment rather than a component the page
 * returns, because the two differ in the only way a crawler or a link checker
 * can see: this renders with a real **404**, where a component returned from a
 * successful render is a 200 saying "gone" in prose. The platform's own 404
 * would get the status right and the message wrong — it tells the visitor they
 * typed something incorrectly, which is untrue and gives them nothing to do.
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
