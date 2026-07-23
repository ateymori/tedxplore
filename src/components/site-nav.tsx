import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { FloatingNavBar } from "@/components/floating-nav-bar";
import { SiteNavLinks, SiteNavUser } from "@/components/site-nav-actions";
import { HOME_PATH } from "@/config/routes";
import { SITE_NAME } from "@/config/site";
import type { SessionUser } from "@/server/auth";

export { SiteNavLinks, SiteNavUser };

/**
 * The application's top navigation.
 *
 * A server component taking the user as a prop rather than reading the session
 * itself, so each layout decides where the session comes from — and so the
 * signed-in state is present in the first HTML rather than appearing a beat
 * later, which a client-side `useSession()` would cause.
 *
 * Deliberately absent from the public event sites under `[site]`: those render
 * the organizer's own template chrome, and a Tedxplore app bar on top of
 * someone's event site would misrepresent whose page it is.
 *
 * ## Why this is split into a shell and an actions half (task 8.0)
 *
 * Cache Components draws a hard line between what can be prerendered and what
 * has to wait for the request, and the nav sits on both sides of it: the bar,
 * its border, and the wordmark are the same for every visitor, while the rest
 * is a function of the session. Kept as one component, the *whole* header is
 * session-dependent and no layout can paint anything until the session
 * resolves.
 *
 * So the layouts render `SiteNavShell` — static, prerendered, in the first
 * byte — and stream `SiteNavLinks`/`SiteNavUser` into it behind their own
 * `<Suspense>` boundaries. `SiteNav` below remains the composed form for any
 * caller that already holds a user and does not need to stream.
 *
 * `SiteNavLinks`/`SiteNavUser` live in `site-nav-actions.tsx` as client
 * components (re-exported here so existing imports keep working) — they need
 * `usePathname()` to highlight the current section, which the
 * session-passed-as-a-prop design above doesn't otherwise require. Each
 * layout calls its session guard twice (once per slot) rather than once and
 * splitting the result — `getCurrentUser`/`requireUser`/`requireAdmin` are
 * all wrapped in React `cache()`, so the second call is free, not a second
 * query.
 *
 * The floating glass-pill chrome itself lives in `FloatingNavBar` (adapted
 * from React Bits Pro's `navigation-9` block): it owns the scroll/motion
 * mechanics and knows nothing about routes or auth, so passing Server
 * Components through as its `navItems`/`actions` slots still lets each
 * subtree suspend and stream independently — `FloatingNavBar` being a client
 * component doesn't pull the session read forward.
 */
export function SiteNavShell({
  navLinks,
  userActions,
}: {
  navLinks: React.ReactNode;
  userActions: React.ReactNode;
}) {
  return (
    <FloatingNavBar
      brand={
        <Link
          href={HOME_PATH}
          className="text-lg font-semibold tracking-tight transition-opacity hover:opacity-70"
        >
          {SITE_NAME}
        </Link>
      }
      navItems={navLinks}
      actions={userActions}
    />
  );
}

/**
 * The fallback for the streamed center nav-links slot.
 */
export function SiteNavLinksSkeleton() {
  return (
    <div className="flex items-center gap-2" aria-hidden="true">
      <Skeleton className="h-4 w-14" />
      <Skeleton className="h-4 w-20" />
    </div>
  );
}

/**
 * The fallback for the streamed right-hand identity slot.
 *
 * Sized to the signed-in layout rather than the signed-out one: a returning
 * visitor with a session is the common case on every route that streams this,
 * and matching the wider arrangement keeps the swap from nudging the page.
 */
export function SiteNavUserSkeleton() {
  return (
    <div className="flex items-center gap-2" aria-hidden="true">
      <Skeleton className="h-8 w-28 rounded-full" />
      <Skeleton className="h-7 w-20 rounded-md" />
    </div>
  );
}

/** The composed nav, for callers that already hold a user and need no streaming. */
export function SiteNav({ user }: { user: SessionUser | null }) {
  return (
    <SiteNavShell
      navLinks={<SiteNavLinks user={user} />}
      userActions={<SiteNavUser user={user} />}
    />
  );
}
