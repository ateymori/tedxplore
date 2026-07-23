import { Suspense } from "react";

import { appFontClassName } from "@/app/fonts";
import { Providers } from "@/components/providers";
import {
  SiteNavLinks,
  SiteNavLinksSkeleton,
  SiteNavShell,
  SiteNavUser,
  SiteNavUserSkeleton,
} from "@/components/site-nav";
import { ThemeSwitch } from "@/components/theme-switch";
import { requireUser } from "@/server/auth-guards";

/**
 * Chrome for the authenticated application.
 *
 * ## Where the gate is (task 8.0 moved it, and the reason matters)
 *
 * This layout used to `await requireUser()` at the top. Under Cache Components
 * that made the entire group unprerenderable — a layout's own await sits
 * *outside* the `<Suspense>` that its own `loading.tsx` provides, so nothing
 * under `/dashboard` could paint a shell.
 *
 * The guard now runs inside the streamed nav slots below. That is safe, and
 * for a checked reason rather than by construction: **every page under this
 * group calls `requireUser` itself** — verified across all four at the time
 * of the change. The layout's guard was always the belt to the pages'
 * braces, never the only gate, so streaming it removes a redundancy and not
 * a boundary. `getCurrentUser` is request-cached, so the nav and the page
 * still share one session lookup — as do the two nav slots with each other.
 *
 * **If a page is ever added here without its own guard, this stops being true**
 * — it would render its body without anything having validated the session.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className={`${appFontClassName} flex min-h-full flex-1 flex-col`}>
        <SiteNavShell
          navLinks={
            <Suspense fallback={<SiteNavLinksSkeleton />}>
              <AppNavLinks />
            </Suspense>
          }
          userActions={
            <Suspense fallback={<SiteNavUserSkeleton />}>
              <AppNavUser />
            </Suspense>
          }
        />

        <main className="mx-auto w-full max-w-8xl flex-1 px-6 py-10">{children}</main>
      </div>
      <ThemeSwitch />
    </Providers>
  );
}

async function AppNavLinks() {
  const user = await requireUser();
  return <SiteNavLinks user={user} />;
}

async function AppNavUser() {
  const user = await requireUser();
  return <SiteNavUser user={user} />;
}
