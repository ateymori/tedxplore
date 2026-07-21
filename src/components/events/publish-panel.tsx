"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CircleCheck,
  CircleDashed,
  ExternalLink,
  EyeOff,
  Rocket,
  Send,
  TriangleAlert,
  Undo2,
} from "lucide-react";

import {
  cancelSubmissionAction,
  republishEventAction,
  submitForReviewAction,
  unpublishEventAction,
} from "@/app/(app)/dashboard/events/[eventId]/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { tedxSiteUrl } from "@/config/site";
import type { CompletenessIssue } from "@/content/completeness";
import { formatDateTime } from "@/lib/format";
import { domainErrorMessage } from "@/lib/form-errors";
import type { PublishStatus } from "@/server/services/publish-service";
import type { Result } from "@/server/services/result";

/**
 * The owner's publishing controls (tasks 7.1, 7.4).
 *
 * One panel for the entire lifecycle rather than a button per verb, because
 * which verbs exist depends entirely on the state — and an organizer opening
 * this should be able to answer "is my site live, and what happens next?"
 * without knowing our vocabulary. The panel therefore leads with a sentence
 * about where the event stands and offers only the actions that apply.
 *
 * Every action is confirmed by the server re-deriving the same rules
 * (`publish-rules.ts`); the buttons shown here are UX, never enforcement. A
 * stale page whose buttons no longer match reality gets a `DomainError`
 * explaining why, not a silent no-op.
 */

type Action = "submit" | "cancel" | "unpublish" | "republish";

export function PublishPanel({
  eventId,
  slug,
  status,
}: {
  eventId: string;
  slug: string;
  status: PublishStatus;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async <T,>(action: Action, perform: () => Promise<Result<T>>) => {
    setPending(action);
    setError(null);

    let result: Result<T>;
    try {
      result = await perform();
    } catch {
      // A Server Action can *throw* as well as return a failed `Result` — a
      // dropped connection, a lost session, a deploy landing mid-click. Without
      // this the button spins forever, because `setPending(null)` never runs.
      // Observed in testing when a session changed during a request.
      setError("Couldn’t reach the server. Check your connection and try again.");
      return;
    } finally {
      setPending(null);
    }

    if (!result.ok) {
      setError(domainErrorMessage(result.error));
      return;
    }

    // The server actions revalidate; this is what makes the page re-render with
    // the new state, so the panel reshapes itself without a full reload.
    router.refresh();
  };

  const isLive = status.publicationStatus === "PUBLISHED";
  const busy = pending !== null;

  return (
    <section
      aria-labelledby="publish-heading"
      className="flex flex-col gap-4 rounded-xl border bg-card p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="publish-heading" className="text-lg font-semibold tracking-tight">
          Publishing
        </h2>
        <StatusLine status={status} slug={slug} />
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {status.lastDecision?.status === "REJECTED" && status.pending === null ? (
        <RejectionNotice
          reason={status.lastDecision.rejectionReason}
          reviewedAt={status.lastDecision.reviewedAt}
        />
      ) : null}

      {/* Shown before submitting, not as the result of trying — an organizer
          should know what's missing while they still have the editor open. */}
      {status.blockingIssues.length > 0 && status.canSubmit ? (
        <MissingContent issues={status.blockingIssues} />
      ) : null}

      <div className="flex flex-wrap gap-2">
        {status.canSubmit ? (
          <Button
            disabled={busy || status.blockingIssues.length > 0}
            onClick={() => {
              void run("submit", () => submitForReviewAction(eventId));
            }}
          >
            {pending === "submit" ? <Spinner /> : <Send />}
            {pending === "submit" ? "Submitting…" : "Submit for review"}
          </Button>
        ) : null}

        {status.canCancel ? (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              void run("cancel", () => cancelSubmissionAction(eventId));
            }}
          >
            {pending === "cancel" ? <Spinner /> : <Undo2 />}
            {pending === "cancel" ? "Cancelling…" : "Cancel submission"}
          </Button>
        ) : null}

        {status.canRepublish ? (
          <Button
            disabled={busy}
            onClick={() => {
              void run("republish", () => republishEventAction(eventId));
            }}
          >
            {pending === "republish" ? <Spinner /> : <Rocket />}
            {pending === "republish" ? "Publishing…" : "Put site back online"}
          </Button>
        ) : null}

        {status.canUnpublish ? (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              void run("unpublish", () => unpublishEventAction(eventId));
            }}
          >
            {pending === "unpublish" ? <Spinner /> : <EyeOff />}
            {pending === "unpublish" ? "Taking offline…" : "Take site offline"}
          </Button>
        ) : null}

        {isLive ? (
          <Button
            variant="ghost"
            nativeButton={false}
            render={<a href={tedxSiteUrl(slug)} target="_blank" rel="noreferrer" />}
          >
            <ExternalLink />
            View live site
          </Button>
        ) : null}
      </div>
    </section>
  );
}

/**
 * One sentence describing where the event stands.
 *
 * Exhaustive over `PublicationStatus`, so a new state cannot ship without
 * someone deciding what to tell the organizer about it.
 */
function StatusLine({ status, slug }: { status: PublishStatus; slug: string }) {
  const pending = status.pending;

  if (pending !== null) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <CircleDashed className="size-4 shrink-0" aria-hidden />
        <span>
          Submitted for review on {formatDateTime(pending.submittedAt)}. We’ll email you when it’s
          been looked at — you can keep editing in the meantime.
        </span>
      </p>
    );
  }

  switch (status.publicationStatus) {
    case "NEVER_PUBLISHED":
      return (
        <p className="text-sm text-muted-foreground">
          This site isn’t published yet. Submit it for review and we’ll publish it at{" "}
          {/* Literal ’ rather than &rsquo;: a text chunk that follows an {expr}
              container and contains an entity loses its leading space (see the
              Phase 5 note in CLAUDE.md). This line hit exactly that. */}
          <span className="font-mono">{tedxSiteUrl(slug)}</span> once it’s approved.
        </p>
      );

    case "PUBLISHED":
      return (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CircleCheck className="size-4 shrink-0 text-emerald-600" aria-hidden />
          <span>
            Your site is live. Changes you make here stay in your draft until you submit them for
            review.
          </span>
        </p>
      );

    case "UNPUBLISHED":
      return (
        <p className="text-sm text-muted-foreground">
          Your site is offline. You can put the last approved version back online at any time — no
          new review needed.
        </p>
      );

    case "SUSPENDED":
      return (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <TriangleAlert className="size-4 shrink-0 text-destructive" aria-hidden />
          <span>
            This site has been suspended and is offline. Check your email for details — only our
            team can restore it.
          </span>
        </p>
      );
  }
}

/** FR-33: the reviewer's reason, kept visible until the owner resubmits. */
function RejectionNotice({
  reason,
  reviewedAt,
}: {
  reason: string | null;
  reviewedAt: Date | null;
}) {
  return (
    <Alert>
      <TriangleAlert />
      <AlertTitle>
        Changes were requested{reviewedAt ? ` on ${formatDateTime(reviewedAt)}` : ""}
      </AlertTitle>
      <AlertDescription>
        {/* Reviewer-authored free text. `whitespace-pre-wrap` keeps their line
            breaks; it is rendered as text, never as markup. */}
        <p className="whitespace-pre-wrap">{reason ?? "No reason was recorded."}</p>
        <p>Make the changes below, then submit again for a fresh review.</p>
      </AlertDescription>
    </Alert>
  );
}

/**
 * BR-14 / FR-30: what still has to be filled in before this can be submitted.
 *
 * Each issue links to the editor section that fixes it — which is why
 * `CompletenessIssue` carries a section at all. A list of field names with no
 * way to act on them would technically satisfy "a clear list" and help nobody.
 */
/**
 * `CompletenessIssue.section` → the editor's anchor id.
 *
 * The two vocabularies are deliberately separate: completeness is a rule about
 * *content* and knows nothing about how an editor is laid out, while the anchor
 * ids belong to `editor-shell.tsx`. They line up everywhere except the display
 * name, which BR-14 calls "basics" and the editor puts in the "Name and theme"
 * section — so one explicit map here, rather than either module bending to the
 * other's naming.
 */
const SECTION_ANCHORS: Record<CompletenessIssue["section"], string> = {
  basics: "hero",
  about: "about",
  schedule: "schedule",
  venue: "venue",
  contact: "contact",
};

function MissingContent({ issues }: { issues: CompletenessIssue[] }) {
  return (
    <Alert>
      <AlertCircle />
      <AlertTitle>
        {issues.length === 1
          ? "One thing is missing before you can submit"
          : `${issues.length} things are missing before you can submit`}
      </AlertTitle>
      <AlertDescription>
        <ul className="flex list-disc flex-col gap-1 pl-4">
          {issues.map((issue) => (
            <li key={issue.field}>
              <a
                href={`#${SECTION_ANCHORS[issue.section]}`}
                className="underline underline-offset-4 hover:text-foreground"
              >
                {issue.message}
              </a>
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
