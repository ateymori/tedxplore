"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Trash2 } from "lucide-react";

import { deleteEventAction } from "@/app/(app)/dashboard/events/actions";
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
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { DASHBOARD_PATH } from "@/config/routes";
import { domainErrorMessage } from "@/lib/form-errors";
import { deletionMode } from "@/server/services/event-rules";
import type { PublicationStatus } from "@/generated/prisma/enums";

/**
 * Delete confirmation (FR-13, task 3.4).
 *
 * The dialog tells the user which of the two deletions they are about to
 * perform, because the consequences differ in a way they can act on: a
 * never-published draft disappears and frees its address, while a site that
 * has been public is retained for audit and keeps its address reserved
 * forever. Presenting both as "delete" would make one of them a surprise.
 *
 * `deletionMode` is the same pure rule the service applies, imported rather
 * than restated — the dialog cannot promise one outcome while the server does
 * the other.
 */
export function DeleteEventDialog({
  eventId,
  displayName,
  slug,
  publicationStatus,
}: {
  eventId: string;
  displayName: string;
  slug: string;
  publicationStatus: PublicationStatus;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const mode = deletionMode(publicationStatus);
  // Typing the address is required only when the deletion is irreversible.
  // Friction on a recoverable action trains people to type through the
  // friction, which is exactly what you don't want on the one that isn't.
  const requiresTypedConfirmation = mode === "HARD";
  const confirmed = !requiresTypedConfirmation || confirmation === slug;

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setConfirmation("");
      setError(null);
    }
  };

  const onDelete = async () => {
    setDeleting(true);
    setError(null);

    const result = await deleteEventAction(eventId);

    if (!result.ok) {
      setError(domainErrorMessage(result.error));
      setDeleting(false);
      return;
    }

    setOpen(false);

    // Always land on the dashboard, never merely refresh: the dialog is also
    // opened from the event's own settings page, and refreshing that would
    // re-render a page whose event no longer exists. From the dashboard this
    // is already the current route, so the `refresh` is what updates the list.
    router.push(DASHBOARD_PATH);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm" aria-label={`Delete ${displayName}`}>
            <Trash2 />
            Delete
          </Button>
        }
      />

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {displayName}?</DialogTitle>
          <DialogDescription>
            {mode === "HARD" ? (
              <>
                This permanently deletes the event and everything in it. The address{" "}
                <span className="font-mono text-foreground">/tedx{slug}</span> becomes available for
                someone else to claim. This cannot be undone.
              </>
            ) : (
              <>
                This takes the site offline and removes it from your dashboard. Because it has been
                published before, we keep a record for our moderation team, and the address{" "}
                <span className="font-mono text-foreground">/tedx{slug}</span> stays reserved so no
                one else can take it.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {requiresTypedConfirmation ? (
          <Field>
            <FieldLabel htmlFor="delete-confirmation">
              Type <span className="font-mono font-semibold">{slug}</span> to confirm
            </FieldLabel>
            <Input
              id="delete-confirmation"
              value={confirmation}
              onChange={(event) => {
                setConfirmation(event.target.value);
              }}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="font-mono"
            />
          </Field>
        ) : null}

        <DialogFooter>
          <DialogClose render={<Button variant="ghost">Cancel</Button>} />
          <Button
            variant="destructive"
            disabled={!confirmed || deleting}
            onClick={() => {
              void onDelete();
            }}
          >
            {deleting ? "Deleting…" : "Delete event"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
