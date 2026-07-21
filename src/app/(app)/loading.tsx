import { Skeleton } from "@/components/ui/skeleton";

/**
 * The streaming boundary for the authenticated application (task 8.0).
 *
 * Under Cache Components every route must declare what it does with uncached
 * data: cache it, or put it behind `<Suspense>`. Nothing under `/dashboard`
 * can be cached — every page here is scoped to one session, and the guards
 * (`requireUser`) read the session before anything renders — so the honest
 * answer is a boundary, and `loading.tsx` is that boundary written once for
 * the whole group rather than hand-placed on each page.
 *
 * The static shell this buys is small but real: the document, fonts, and the
 * page frame are prerendered and paint immediately, and the session-dependent
 * body streams in behind it. It replaces nothing — before Cache Components
 * these routes were simply dynamic with no shell at all.
 */
export default function AppLoading() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true" aria-label="Loading">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-64" />
      </div>

      <div className="flex flex-col gap-4">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
    </div>
  );
}
