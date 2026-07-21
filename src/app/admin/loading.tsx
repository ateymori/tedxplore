import { Skeleton } from "@/components/ui/skeleton";

/**
 * Streaming boundary for the admin area — same reasoning as the `(app)` group's
 * (task 8.0): role-gated, per-session, nothing here is cacheable.
 *
 * Wider than the `(app)` skeleton because the admin shell is a `max-w-6xl`
 * table-shaped surface (queue, events index) rather than a card list.
 */
export default function AdminLoading() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true" aria-label="Loading">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-5 w-72" />
      </div>

      <div className="flex flex-col gap-3">
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    </div>
  );
}
