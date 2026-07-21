"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * One tab in the admin nav.
 *
 * A client component only because marking the current tab needs the pathname.
 * The links themselves are plain `next/link` and work without JavaScript; this
 * adds the highlight and `aria-current`, nothing else.
 *
 * `exact` exists because the review queue lives at `/admin` itself, which is a
 * prefix of every other admin route — without it, "Review queue" would look
 * active on every page in the area.
 */
export function AdminNavLink({
  href,
  children,
  badge,
  exact = false,
}: {
  href: string;
  children: React.ReactNode;
  /** A count worth interrupting for; `0` renders nothing rather than a "0". */
  badge?: number;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
        active
          ? "bg-background font-medium text-foreground shadow-xs"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
      {badge !== undefined && badge > 0 ? (
        <span className="rounded-full bg-primary px-1.5 py-0.5 text-xs font-medium text-primary-foreground tabular-nums">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}
