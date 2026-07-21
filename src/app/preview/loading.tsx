import { Spinner } from "@/components/ui/spinner";

/**
 * Streaming boundary for both preview routes (task 8.0) — the owner's
 * `/preview/draft/[eventId]` and the tokenized `/preview/[token]`.
 *
 * One file at the shared segment rather than two leaf ones, because both render
 * the same thing: a whole event site, full-bleed, with no app chrome around it.
 * There is no partial shell worth drawing for that — a skeleton of someone
 * else's template would be an invention — so this is a plain centred spinner
 * and the real page replaces it wholesale.
 *
 * Neither route may be cached: the draft changes as it is edited, and FR-26
 * requires token revocation to take effect on the very next request. This
 * boundary changes nothing about that — it only gives the uncached work a place
 * to suspend, which Cache Components requires it to have.
 */
export default function PreviewLoading() {
  return (
    <div
      className="flex min-h-svh flex-1 items-center justify-center"
      aria-busy="true"
      aria-label="Loading preview"
    >
      <Spinner className="size-6 text-muted-foreground" />
    </div>
  );
}
