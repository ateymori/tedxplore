"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, X } from "lucide-react";

import { approveRequestAction, rejectRequestAction } from "@/app/admin/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { REJECTION_REASON_MAX_LENGTH, REJECTION_REASON_MIN_LENGTH } from "@/config/limits";
import { domainErrorMessage } from "@/lib/form-errors";

/**
 * Approve / reject (task 7.3, FR-32, FR-33).
 *
 * The asymmetry between the two verbs is the design. Approving is one click:
 * the reviewer has just scrolled the whole site and a confirmation step would
 * only train them to dismiss it. Rejecting opens a dialog, because FR-33 makes
 * the reason mandatory and that reason is the entire body of the email the
 * organizer receives — there is nothing to confirm, but there is something to
 * write.
 *
 * Both refuse to be pressed twice: the actions are scoped to `PENDING` in the
 * repository, so a second press gets an honest "already decided" rather than a
 * second swap, and `pending` here stops it from being sent at all.
 */
export function ReviewDecisionBar({
  requestId,
  eventName,
  firstPublication,
}: {
  requestId: string;
  eventName: string;
  firstPublication: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Held here rather than in the dialog so a validation failure doesn't discard
  // what the reviewer typed when the dialog re-renders.
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);

  const onApprove = async () => {
    setPending("approve");
    setError(null);

    let result;
    try {
      result = await approveRequestAction(requestId);
    } catch {
      // A Server Action can throw as well as return a failed `Result` — a dropped
      // connection, a lost session, a deploy landing mid-click. Without catching
      // it the button spins forever, because `setPending(null)` never runs.
      setError("Couldn’t reach the server. Check your connection and try again.");
      return;
    } finally {
      setPending(null);
    }

    if (!result.ok) {
      setError(domainErrorMessage(result.error));
      return;
    }

    router.refresh();
  };

  const onReject = async () => {
    const trimmed = reason.trim();

    // Client-side only for the immediate message; the server re-validates with
    // the same schema (`lib/validation/review.ts`) and is what actually decides.
    if (trimmed.length < REJECTION_REASON_MIN_LENGTH) {
      setReasonError(
        `Explain what needs to change — at least ${REJECTION_REASON_MIN_LENGTH} characters, so the organizer knows what to fix.`,
      );
      return;
    }

    setPending("reject");
    setReasonError(null);
    setError(null);

    let result;
    try {
      result = await rejectRequestAction(requestId, { reason: trimmed });
    } catch {
      setReasonError("Couldn’t reach the server. Check your connection and try again.");
      return;
    } finally {
      setPending(null);
    }

    if (!result.ok) {
      setReasonError(domainErrorMessage(result.error));
      return;
    }

    setRejectOpen(false);
    router.refresh();
  };

  const busy = pending !== null;

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold tracking-tight">Decision</h2>
        <p className="text-xs text-muted-foreground">
          {firstPublication
            ? "Approving publishes this site for the first time."
            : "Approving replaces the version currently live."}
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-2">
        <Button
          disabled={busy}
          onClick={() => {
            void onApprove();
          }}
        >
          {pending === "approve" ? <Spinner /> : <Check />}
          {pending === "approve" ? "Approving…" : "Approve and publish"}
        </Button>

        <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
          <DialogTrigger
            render={
              <Button variant="outline" disabled={busy}>
                <X />
                Request changes
              </Button>
            }
          />

          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request changes</DialogTitle>
              <DialogDescription>
                {eventName}&rsquo;s organizer gets this message by email, and it stays visible in
                their editor until they resubmit. It is the only thing telling them what to fix.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="rejection-reason" className="text-sm font-medium">
                What needs to change?
              </label>
              <Textarea
                id="rejection-reason"
                rows={6}
                value={reason}
                maxLength={REJECTION_REASON_MAX_LENGTH}
                aria-invalid={reasonError !== null}
                aria-describedby={reasonError === null ? undefined : "rejection-reason-error"}
                onChange={(event) => {
                  setReason(event.target.value);
                  if (reasonError !== null) setReasonError(null);
                }}
                placeholder="Be specific and actionable — which section, and what about it."
              />
              {reasonError === null ? null : (
                <FieldError id="rejection-reason-error">{reasonError}</FieldError>
              )}
            </div>

            <DialogFooter>
              <DialogClose render={<Button variant="ghost">Cancel</Button>} />
              <Button
                variant="destructive"
                disabled={busy}
                onClick={() => {
                  void onReject();
                }}
              >
                {pending === "reject" ? <Spinner /> : null}
                {pending === "reject" ? "Sending…" : "Send and reject"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <p className="text-xs text-muted-foreground">
        Rejecting leaves any currently live version untouched.
      </p>
    </section>
  );
}
