import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ADMIN_PATH, DASHBOARD_PATH, HOME_PATH, LOGIN_PATH } from "@/config/routes";
import { SITE_NAME } from "@/config/site";
import type { SessionUser } from "@/server/auth";

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
 * its border, and the wordmark are the same for every visitor, while the right
 * side is a function of the session. Kept as one component, the *whole* header
 * is session-dependent and no layout can paint anything until the session
 * resolves.
 *
 * So the layouts render `SiteNavShell` — static, prerendered, in the first byte
 * — and stream `SiteNavActions` into it behind a `<Suspense>`. `SiteNav` below
 * remains the composed form for any caller that already holds a user and does
 * not need to stream.
 */
export function SiteNavShell({ children }: { children: React.ReactNode }) {
  return (
    <header className="border-b">
      <nav className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-4">
        <Link
          href={HOME_PATH}
          className="text-lg font-semibold tracking-tight transition-opacity hover:opacity-70"
        >
          {SITE_NAME}
        </Link>

        {children}
      </nav>
    </header>
  );
}

/**
 * The fallback for the streamed half.
 *
 * Sized to the signed-in layout rather than the signed-out one: a returning
 * visitor with a session is the common case on every route that streams this,
 * and matching the taller arrangement keeps the swap from nudging the page.
 */
export function SiteNavActionsSkeleton() {
  return (
    <div className="flex items-center gap-3" aria-hidden="true">
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-20 rounded-md" />
    </div>
  );
}

export function SiteNavActions({ user }: { user: SessionUser | null }) {
  return (
    <>
      {user ? (
        <div className="flex items-center gap-3">
          {user.role === "ADMIN" ? (
            <Link
              href={ADMIN_PATH}
              className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Admin
            </Link>
          ) : null}
          <Link
            href={DASHBOARD_PATH}
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Dashboard
          </Link>
          {/* Falls back to the email for Google accounts that supplied no name. */}
          <span className="max-w-[16ch] truncate text-sm font-medium">
            {user.name || user.email}
          </span>
          <SignOutButton />
        </div>
      ) : (
        // Base UI composes via `render`, not shadcn/Radix's `asChild`.
        // `nativeButton={false}` tells it this renders an <a>, not a
        // <button> — without it Base UI applies native button semantics to
        // an anchor, which it warns about at runtime.
        <Button size="sm" nativeButton={false} render={<Link href={LOGIN_PATH} />}>
          Log In / Sign Up
        </Button>
      )}
    </>
  );
}

/** The composed nav, for callers that already hold a user and need no streaming. */
export function SiteNav({ user }: { user: SessionUser | null }) {
  return (
    <SiteNavShell>
      <SiteNavActions user={user} />
    </SiteNavShell>
  );
}
