"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ADMIN_PATH, DASHBOARD_PATH, HOME_PATH, LOGIN_PATH } from "@/config/routes";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/server/auth";

/**
 * Marks a nav link "active" for the current route: an exact match, or a
 * prefix match with a trailing slash so a nested route (e.g. an
 * `/admin/review/[requestId]` detail page) still highlights its section's
 * top-level link. Anchor links (`#section`) are never routes, so they never
 * count as active.
 */
function isActiveLink(pathname: string, href: string): boolean {
  if (href.startsWith("#")) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The one place the active/inactive nav-link styles live. */
function linkClassName(active: boolean): string {
  return cn(
    "rounded-sm px-3.5 py-2 text-sm transition-colors",
    active
      ? "bg-primary font-medium text-primary-foreground"
      : "text-muted-foreground hover:bg-muted hover:text-foreground",
  );
}

/** First letter of up to two words — "Ada Lovelace" -> "AL", "ada@x.com" -> "A". */
function getInitials(nameOrEmail: string): string {
  const words = nameOrEmail.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 1).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

/**
 * The signed-in identity as a circular avatar button that opens the account
 * info dropdown. The name lives in the menu's header row instead of the nav
 * bar itself, so the trigger needs its own accessible name.
 */
function ProfileMenuTrigger({ user }: { user: SessionUser }) {
  const label = user.name || user.email;

  return (
    <DropdownMenuTrigger
      aria-label={`Account menu for ${label}`}
      className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full border border-border/60 bg-primary text-[13px] font-semibold text-primary-foreground shadow-sm outline-none transition-all duration-200 ease-out hover:brightness-110 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:ring-3 data-popup-open:ring-ring/40"
    >
      {getInitials(label)}
    </DropdownMenuTrigger>
  );
}

/**
 * The center nav slot: Home for everyone, plus section links for a signed-in
 * user (Dashboard, and Admin for admins).
 *
 * A client component only because marking the current link needs the
 * pathname — everything else about `user` still arrives as a server-computed
 * prop (see `site-nav.tsx`), so this doesn't reintroduce a client-side
 * session read.
 */
export function SiteNavLinks({ user }: { user: SessionUser | null }) {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1">
      <Link
        href={HOME_PATH}
        aria-current={isActiveLink(pathname, HOME_PATH) ? "page" : undefined}
        className={linkClassName(isActiveLink(pathname, HOME_PATH))}
      >
        Home
      </Link>
      {user?.role === "ADMIN" ? (
        <Link
          href={ADMIN_PATH}
          aria-current={isActiveLink(pathname, ADMIN_PATH) ? "page" : undefined}
          className={linkClassName(isActiveLink(pathname, ADMIN_PATH))}
        >
          Admin
        </Link>
      ) : null}
      {user ? (
        <Link
          href={DASHBOARD_PATH}
          aria-current={isActiveLink(pathname, DASHBOARD_PATH) ? "page" : undefined}
          className={linkClassName(isActiveLink(pathname, DASHBOARD_PATH))}
        >
          Dashboard
        </Link>
      ) : null}
    </div>
  );
}

/**
 * The right-side slot: the avatar's account-info dropdown (name today, with
 * room to grow — e.g. a future Settings entry — below it) next to a
 * standalone Sign out button, or the login/signup CTA.
 *
 * Sign out deliberately stays outside the dropdown: it's the single most
 * frequent action a signed-in user takes here, and burying it a click deep
 * behind the avatar costs more than the dropdown gains in tidiness.
 */
export function SiteNavUser({ user }: { user: SessionUser | null }) {
  if (user) {
    const label = user.name || user.email;

    return (
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <ProfileMenuTrigger user={user} />
          <DropdownMenuContent align="end" sideOffset={10} className="w-56">
            <div className="flex flex-col gap-0.5 px-1.5 py-1.5">
              <span className="truncate text-sm font-medium text-foreground">{label}</span>
              {/* Only shown when it differs from the label above — Google accounts
                  with no name fall back to the email as the label itself. */}
              {user.name ? (
                <span className="truncate text-xs text-muted-foreground">{user.email}</span>
              ) : null}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
        <SignOutButton />
      </div>
    );
  }

  // Base UI composes via `render`, not shadcn/Radix's `asChild`.
  // `nativeButton={false}` tells it this renders an <a>, not a
  // <button> — without it Base UI applies native button semantics to
  // an anchor, which it warns about at runtime.
  return (
    <Button
      size="sm"
      nativeButton={false}
      render={<Link href={LOGIN_PATH} />}
      className="h-9 rounded-xl"
    >
      Log In / Sign Up
    </Button>
  );
}
