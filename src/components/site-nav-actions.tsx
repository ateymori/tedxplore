"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { Button } from "@/components/ui/button";
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
    "rounded-full px-3 py-1.5 text-sm transition-colors",
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

/** The signed-in identity as an avatar chip, replacing a bare name/email string. */
function UserChip({ user }: { user: SessionUser }) {
  const label = user.name || user.email;

  return (
    <div className="flex items-center gap-1.5 rounded-full border bg-muted/40 py-1 pr-3 pl-1">
      <span
        aria-hidden="true"
        className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground"
      >
        {getInitials(label)}
      </span>
      {/* Falls back to the email for Google accounts that supplied no name. */}
      <span className="max-w-[14ch] truncate text-sm font-medium">{label}</span>
    </div>
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

/** The right-side slot: the identity chip + sign-out, or the login/signup CTA. */
export function SiteNavUser({ user }: { user: SessionUser | null }) {
  if (user) {
    return (
      <div className="flex items-center gap-2">
        <UserChip user={user} />
        <SignOutButton />
      </div>
    );
  }

  // Base UI composes via `render`, not shadcn/Radix's `asChild`.
  // `nativeButton={false}` tells it this renders an <a>, not a
  // <button> — without it Base UI applies native button semantics to
  // an anchor, which it warns about at runtime.
  return (
    <Button size="sm" nativeButton={false} render={<Link href={LOGIN_PATH} />}>
      Log In / Sign Up
    </Button>
  );
}
