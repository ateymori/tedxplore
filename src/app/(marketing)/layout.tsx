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
import { getCurrentUser } from "@/server/auth-guards";

/**
 * Public pages: browsable without a session (FR-49), but the nav reflects one
 * when it exists.
 *
 * The nav must show the signed-in state in server-rendered HTML — a client-side
 * `useSession()` would flash "Log In" at every returning visitor — so the
 * session is still read on the server, never in the browser.
 *
 * ## What task 8.0 changed
 *
 * Reading the session at the top of this layout used to make the whole
 * marketing surface dynamic, which 4.9 noted and accepted. Under Cache
 * Components that is no longer the trade on offer: the session read is now
 * isolated to the streamed nav slots, so everything else — the wordmark,
 * the headline, the template grid — prerenders as a static shell and is served
 * from the first byte, with the nav's session-dependent parts arriving a beat
 * later.
 *
 * This is precisely the "static page with a session-aware island" shape the
 * previous note said to move to should this surface ever need CDN caching.
 * Cache Components made it the path of least resistance, so it is taken now.
 * The homepage's Edit buttons (FR-51) are the page's own session-aware island
 * and are handled the same way there.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className={`${appFontClassName} flex min-h-full flex-1 flex-col`}>
        <SiteNavShell
          navLinks={
            <Suspense fallback={<SiteNavLinksSkeleton />}>
              <MarketingNavLinks />
            </Suspense>
          }
          userActions={
            <Suspense fallback={<SiteNavUserSkeleton />}>
              <MarketingNavUser />
            </Suspense>
          }
        />

        {children}
      </div>
      <ThemeSwitch />
    </Providers>
  );
}

async function MarketingNavLinks() {
  const user = await getCurrentUser();
  return <SiteNavLinks user={user} />;
}

async function MarketingNavUser() {
  const user = await getCurrentUser();
  return <SiteNavUser user={user} />;
}
