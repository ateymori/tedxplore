import { SiteNav } from "@/components/site-nav";
import { getCurrentUser } from "@/server/auth-guards";

/**
 * Public pages: browsable without a session (FR-49), but the nav reflects one
 * when it exists.
 *
 * Reading the session here makes these pages dynamic, which 4.9 revisited and
 * kept. The nav must show the signed-in state in the first HTML — a client-side
 * `useSession()` would flash "Log In" at every returning visitor — and the
 * homepage's Edit buttons point somewhere different depending on the session
 * (FR-51), so the page could not be cached across viewers regardless.
 *
 * The cost is small and bounded: `getCurrentUser` is React-cached, so the
 * layout and the page share one session lookup, the render ships no additional
 * client JavaScript, and nothing here blocks paint. Should the marketing
 * surface ever need CDN caching, the shape to move to is a static page with a
 * session-aware island — not a client-side session read for the whole tree.
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
