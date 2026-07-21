import { Skeleton } from "@/components/ui/skeleton";

/**
 * Streaming boundary for the auth pages (task 8.0).
 *
 * These pages are not session-dependent — they are `searchParams`-dependent:
 * `returnTo` on login and signup, `token` on password reset and email
 * verification. Under Cache Components reading `searchParams` is runtime data
 * like any other and needs a boundary, so the shell (wordmark, card frame)
 * prerenders and the form streams in once the query string is known.
 *
 * `(auth)/layout.tsx` is fully synchronous, so unlike the `(app)` and `admin`
 * groups nothing had to move — this file alone is the whole migration here.
 */
export default function AuthLoading() {
  return (
    <div className="flex w-full flex-col gap-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-4 w-56" />
      <Skeleton className="mt-2 h-10 w-full rounded-md" />
      <Skeleton className="h-10 w-full rounded-md" />
      <Skeleton className="h-10 w-full rounded-md" />
    </div>
  );
}
