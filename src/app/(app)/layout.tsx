import { SiteNav } from "@/components/site-nav";
import { requireUser } from "@/server/auth-guards";

/**
 * Chrome for the authenticated application.
 *
 * `requireUser` here is the actual gate — the proxy's cookie check only
 * redirects, it never validates. Nested pages may call the guards again for
 * their own reasons, and `getCurrentUser` is request-cached so doing so costs
 * nothing.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteNav user={user} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">{children}</main>
    </div>
  );
}
