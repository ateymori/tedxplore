"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, RotateCcw, ShieldAlert } from "lucide-react";

import { restoreEventAction, suspendEventAction } from "@/app/admin/actions";
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
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { REJECTION_REASON_MAX_LENGTH } from "@/config/limits";
import { domainErrorMessage } from "@/lib/form-errors";

/**
 * Suspend and restore (task 7.5, FR-44, BR-10).
 *
 * Suspension is behind a dialog and restore is one click — the inverse of the
 * approve/reject asymmetry next door, and for the same reason: the dialog
 * exists where there is something to *write*, not merely something to confirm.
 * Here the reason is optional (a suspension may be urgent), so the dialog's job
 * is mostly to make the reviewer pause over an action that takes a stranger's
 * site off the internet immediately.
 *
 * When neither action applies, the panel says why rather than disappearing. An
 * admin looking for "suspend" on a never-published event should find an answer,
 * not an absence.
 */
export function SuspensionControls({
  eventId,
  eventName,
  canSuspend,
  canRestore,
}: {
  eventId: string;
  eventName: string;
  canSuspend: boolean;
  canRestore: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"suspend" | "restore" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [suspendOpen, setSuspendOpen] = useState(false);

  const onSuspend = async () => {
    setPending("suspend");
    setError(null);

    const trimmed = reason.trim();

    let result;
    try {
      result = await suspendEventAction(eventId, {
        reason: trimmed.length === 0 ? null : trimmed,
      });
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

    setSuspendOpen(false);
    setReason("");
    router.refresh();
  };

  const onRestore = async () => {
    setPending("restore");
    setError(null);

    let result;
    try {
      result = await restoreEventAction(eventId);
    } catch {
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

  const busy = pending !== null;

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <h2 className="text-sm font-semibold tracking-tight">Moderation</h2>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {canSuspend ? (
        <>
          <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
            <DialogTrigger
              render={
                <Button variant="destructive" disabled={busy}>
                  <ShieldAlert />
                  Suspend site
                </Button>
              }
            />

            <DialogContent>
              <DialogHeader>
                <DialogTitle>Suspend {eventName}?</DialogTitle>
                <DialogDescription>
                  The site goes offline immediately and the owner is emailed. They cannot put it
                  back themselves — only an admin can restore it.
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="suspension-reason" className="text-sm font-medium">
                  Reason <span className="text-muted-foreground">(optional)</span>
                </label>
                <Textarea
                  id="suspension-reason"
                  rows={4}
                  value={reason}
                  maxLength={REJECTION_REASON_MAX_LENGTH}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Included in the email to the owner. Leave blank if this is urgent."
                />
                <p className="text-xs text-muted-foreground">
                  If you leave this blank, the email says the site was suspended without saying why.
                </p>
              </div>

              <DialogFooter>
                <DialogClose render={<Button variant="ghost">Cancel</Button>} />
                <Button
                  variant="destructive"
                  disabled={busy}
                  onClick={() => {
                    void onSuspend();
                  }}
                >
                  {pending === "suspend" ? <Spinner /> : <ShieldAlert />}
                  {pending === "suspend" ? "Suspending…" : "Suspend now"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <p className="text-xs text-muted-foreground">
            Takes the public site offline immediately, including if the owner has already
            unpublished it.
          </p>
        </>
      ) : null}

      {canRestore ? (
        <>
          <Button
            disabled={busy}
            onClick={() => {
              void onRestore();
            }}
          >
            {pending === "restore" ? <Spinner /> : <RotateCcw />}
            {pending === "restore" ? "Restoring…" : "Restore site"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Puts the event back exactly where it was before it was suspended — live if it was live,
            offline if the owner had already taken it down.
          </p>
        </>
      ) : null}

      {!canSuspend && !canRestore ? (
        <p className="text-xs text-muted-foreground">
          Nothing to moderate here: this event has no published site to take offline. A
          never-published event can only reach the public through the review queue.
        </p>
      ) : null}
    </section>
  );
}
