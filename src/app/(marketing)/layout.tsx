import { SiteNav } from "@/components/site-nav";
import { getCurrentUser } from "@/server/auth-guards";

/**
 * Public pages: browsable without a session (FR-49), but the nav reflects one
 * when it exists.
 *
 * Reading the session here makes these pages dynamic. That is a fine trade for
 * a placeholder home page and avoids the signed-out flash a client-side
 * `useSession()` would produce. Phase 4.9 builds the real template gallery and
 * should revisit it — a session-aware island inside an otherwise static page is
 * the shape to aim for once the page has real content worth prerendering.
 */
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteNav user={user} />
      {children}
    </div>
  );
}
