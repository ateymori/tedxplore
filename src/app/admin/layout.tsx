import { SiteNav } from "@/components/site-nav";
import { requireAdmin } from "@/server/auth-guards";

/**
 * The admin area sits outside the `(app)` group so Phase 7 can give it its own
 * chrome, but the role gate belongs here at the boundary rather than on each
 * page — a new admin page must not be able to forget it.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteNav user={admin} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">{children}</main>
    </div>
  );
}
