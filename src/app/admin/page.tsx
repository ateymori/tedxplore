import type { Metadata } from "next";
import { requireAdmin } from "@/server/auth-guards";

export const metadata: Metadata = { title: "Admin" };

/**
 * Placeholder. Phase 7 builds the review queue here — for now it exists so the
 * `ADMIN` role gate (FR-4) is exercised end to end.
 */
export default async function AdminPage() {
  const admin = await requireAdmin();

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
      <p className="mt-2 text-muted-foreground">
        Signed in as {admin.email}. The review queue arrives in Phase 7.
      </p>
    </>
  );
}
