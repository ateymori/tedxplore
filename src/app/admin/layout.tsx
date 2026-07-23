import { Suspense } from "react";
import Link from "next/link";

import { appFontClassName } from "@/app/fonts";
import { AdminNavLink } from "@/components/admin/admin-nav-link";
import { Providers } from "@/components/providers";
import {
  SiteNavLinks,
  SiteNavLinksSkeleton,
  SiteNavShell,
  SiteNavUser,
  SiteNavUserSkeleton,
} from "@/components/site-nav";
import { ThemeSwitch } from "@/components/theme-switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ADMIN_EVENTS_PATH,
  ADMIN_REPORTS_PATH,
  DASHBOARD_PATH,
  REVIEW_QUEUE_PATH,
} from "@/config/routes";
import { requireAdmin } from "@/server/auth-guards";
import { countPendingReviews } from "@/server/services/admin-service";
import { countOpenReports } from "@/server/services/report-admin-service";

/**
 * The admin area sits outside the `(app)` group so it can carry its own chrome.
 *
 * ## Where the role gate is, after task 8.0
 *
 * This layout used to `await requireAdmin()` at the top, and its note said the
 * gate belonged here so that "a new admin page must not be able to forget it".
 * Cache Components made that position untenable: a layout's own await is
 * outside the `<Suspense>` its `loading.tsx` provides, so holding the gate here
 * meant the entire admin area could never prerender a shell.
 *
 * The gate is now streamed, and the honest statement of what protects this area
 * is three-deep rather than one-deep:
 *
 *   1. The proxy bounces anyone without a session cookie off `/admin/*`
 *      (optimistic only — it never validates).
 *   2. **Every admin page calls `requireAdmin` itself** — verified across all
 *      four at the time of this change. This is now load-bearing rather than
 *      redundant, which is the real cost of the move.
 *   3. Every admin *service* re-checks the role (`review-service.ts`,
 *      `admin-service.ts`), so even a page that forgot (2) could not read or
 *      change anything. That check was always there for a different reason —
 *      a service called from a script or a route handler is not protected by
 *      any route — and it is what keeps this safe rather than merely tidy.
 *
 * A new page here that skips `requireAdmin` would render its own chrome to a
 * non-admin before the services refused it. Layer 3 means it would show no
 * data; it would still be a bug worth catching in review.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className={`${appFontClassName} flex min-h-full flex-1 flex-col`}>
        <SiteNavShell
          navLinks={
            <Suspense fallback={<SiteNavLinksSkeleton />}>
              <AdminNavLinks />
            </Suspense>
          }
          userActions={
            <Suspense fallback={<SiteNavUserSkeleton />}>
              <AdminNavUser />
            </Suspense>
          }
        />

        <div className="border-b bg-muted/30">
          {/*
            The whole section nav streams, not just the queue badge.

            `AdminNavLink` marks the current tab with `usePathname()`, and on the
            two dynamic admin routes (`/admin/review/[requestId]`,
            `/admin/events/[eventId]`) the pathname is not known until the request
            — so the links are runtime data even before the pending count is. One
            boundary around the whole row is therefore both necessary and the
            smaller change; a nested boundary for the badge alone would not have
            covered the links.
          */}
          <Suspense fallback={<AdminSectionNavFallback />}>
            <AdminSectionNav />
          </Suspense>
        </div>

        <main className="mx-auto w-full max-w-8xl flex-1 px-6 py-10">{children}</main>

        <footer className="border-t px-6 py-4">
          <div className="mx-auto w-full max-w-8xl">
            <Suspense fallback={<Skeleton className="h-4 w-72" />}>
              <AdminFooter />
            </Suspense>
          </div>
        </footer>
      </div>
      <ThemeSwitch />
    </Providers>
  );
}

async function AdminNavLinks() {
  const admin = await requireAdmin();
  return <SiteNavLinks user={admin} />;
}

async function AdminNavUser() {
  const admin = await requireAdmin();
  return <SiteNavUser user={admin} />;
}

const SECTION_NAV_CLASS = "mx-auto flex w-full max-w-8xl items-center gap-1 px-6 py-2";

async function AdminSectionNav() {
  const admin = await requireAdmin();

  // The queue depth is the one number an admin wants before deciding where to
  // click. It degrades to no badge rather than taking the whole area down.
  // Both counts in one round trip: they are independent queries and the nav
  // cannot paint until it has both anyway.
  const [pending, open] = await Promise.all([countPendingReviews(admin), countOpenReports(admin)]);
  const pendingCount = pending.ok ? pending.value : 0;
  const openReports = open.ok ? open.value : 0;

  return (
    <nav aria-label="Admin sections" className={SECTION_NAV_CLASS}>
      <AdminNavLink href={REVIEW_QUEUE_PATH} exact badge={pendingCount}>
        Review queue
      </AdminNavLink>
      <AdminNavLink href={ADMIN_REPORTS_PATH} badge={openReports}>
        Reports
      </AdminNavLink>
      <AdminNavLink href={ADMIN_EVENTS_PATH}>Events</AdminNavLink>
    </nav>
  );
}

/**
 * Placeholder tabs at the real ones' size, so the bar has its full height from
 * the first paint and the page below it does not jump when the nav resolves.
 *
 * Not `AdminNavLink` itself: that is a client component whose `usePathname()`
 * call is the very thing being suspended.
 */
function AdminSectionNavFallback() {
  return (
    <div className={SECTION_NAV_CLASS} aria-hidden="true">
      <Skeleton className="h-8 w-32 rounded-md" />
      <Skeleton className="h-8 w-24 rounded-md" />
      <Skeleton className="h-8 w-20 rounded-md" />
    </div>
  );
}

async function AdminFooter() {
  const admin = await requireAdmin();

  return (
    <p className="text-xs text-muted-foreground">
      Signed in as {admin.email} (admin).{" "}
      <Link href={DASHBOARD_PATH} className="underline underline-offset-4">
        Back to your own events
      </Link>
    </p>
  );
}
