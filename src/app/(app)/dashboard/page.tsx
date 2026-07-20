import type { Metadata } from "next";
import { requireUser } from "@/server/auth-guards";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * Placeholder. Phase 3.2 replaces this with the real event dashboard — for now
 * it exists so the authentication flows have a destination to land on.
 */
export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-tight">Welcome, {user.name || user.email}</h1>
      <p className="text-muted-foreground">
        Your events will appear here once event creation ships (Phase 3).
      </p>
    </div>
  );
}
