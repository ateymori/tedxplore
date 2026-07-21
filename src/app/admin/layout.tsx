import Link from "next/link";

import { AdminNavLink } from "@/components/admin/admin-nav-link";
import { SiteNav } from "@/components/site-nav";
import { ADMIN_EVENTS_PATH, DASHBOARD_PATH, REVIEW_QUEUE_PATH } from "@/config/routes";
import { requireAdmin } from "@/server/auth-guards";
import { countPendingReviews } from "@/server/services/admin-service";

/**
 * The admin area sits outside the `(app)` group so it can carry its own chrome,
 * but the role gate belongs here at the boundary rather than on each page — a
 * new admin page must not be able to forget it.
 *
 * The services behind these pages re-check the role anyway (see
 * `review-service.ts`). That is not redundancy for its own sake: a layout guard
 * protects a *route*, and the day one of these services is called from a route
 * handler or a script, the route is not what is protecting it.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  // The queue depth is the one number an admin wants before deciding where to
  // click. It degrades to no badge rather than taking the whole area down.
  const pending = await countPendingReviews(admin);
  const pendingCount = pending.ok ? pending.value : 0;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteNav user={admin} />

      <div className="border-b bg-muted/30">
        <nav
          aria-label="Admin sections"
          className="mx-auto flex w-full max-w-6xl items-center gap-1 px-6 py-2"
        >
          <AdminNavLink href={REVIEW_QUEUE_PATH} exact badge={pendingCount}>
            Review queue
          </AdminNavLink>
          <AdminNavLink href={ADMIN_EVENTS_PATH}>Events</AdminNavLink>
        </nav>
      </div>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">{children}</main>

      <footer className="border-t px-6 py-4">
        <p className="mx-auto w-full max-w-6xl text-xs text-muted-foreground">
          Signed in as {admin.email} (admin).{" "}
          <Link href={DASHBOARD_PATH} className="underline underline-offset-4">
            Back to your own events
          </Link>
        </p>
      </footer>
    </div>
  );
}
