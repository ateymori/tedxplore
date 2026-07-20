import Link from "next/link";
import { Button } from "@/components/ui/button";
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
 */
export function SiteNav({ user }: { user: SessionUser | null }) {
  return (
    <header className="border-b">
      <nav className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-4">
        <Link
          href={HOME_PATH}
          className="text-lg font-semibold tracking-tight transition-opacity hover:opacity-70"
        >
          {SITE_NAME}
        </Link>

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
          <Button size="sm" render={<Link href={LOGIN_PATH} />}>
            Log In / Sign Up
          </Button>
        )}
      </nav>
    </header>
  );
}
