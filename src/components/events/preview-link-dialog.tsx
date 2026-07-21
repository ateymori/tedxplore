"use client";

import { useState } from "react";
import { AlertCircle, Check, Copy, Link2, RefreshCw, Share2 } from "lucide-react";

import {
  issuePreviewLinkAction,
  revokePreviewLinkAction,
} from "@/app/(app)/dashboard/events/[eventId]/actions";
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
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { previewLinkUrl } from "@/config/routes";
import { formatDate } from "@/lib/format";
import { domainErrorMessage } from "@/lib/form-errors";

/**
 * Preview link management (FR-25, FR-26, task 6.3).
 *
 * One dialog for the whole feature, because there is only ever one link. The
 * three verbs the owner has — create, replace, turn off — are the same two
 * server operations (`issue`, `revoke`) with "replace" being an issue over an
 * existing token; the copy is what distinguishes them, not the plumbing.
 *
 * The current token is server-rendered into `initialLink` rather than fetched
 * when the dialog opens. It is one column on a page that already loaded the
 * event, so fetching it separately would buy a loading state and nothing else
 * — and the owner's own page is not somewhere a token needs hiding.
 */

export interface PreviewLinkState {
  token: string;
  createdAt: Date;
}

export function PreviewLinkDialog({
  eventId,
  initialLink,
}: {
  eventId: string;
  initialLink: PreviewLinkState | null;
}) {
  const [link, setLink] = useState(initialLink);
  const [pending, setPending] = useState<"issue" | "revoke" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const url = link === null ? null : previewLinkUrl(link.token);

  const onIssue = async () => {
    setPending("issue");
    setError(null);

    const result = await issuePreviewLinkAction(eventId);
    setPending(null);

    if (!result.ok) {
      setError(domainErrorMessage(result.error));
      return;
    }

    setLink(result.value);
    // A replaced link is a different string in the same box; without clearing
    // this, the tick from the previous copy would still be showing and imply
    // the *new* URL is on the clipboard.
    setCopied(false);
  };

  const onRevoke = async () => {
    setPending("revoke");
    setError(null);

    const result = await revokePreviewLinkAction(eventId);
    setPending(null);

    if (!result.ok) {
      setError(domainErrorMessage(result.error));
      return;
    }

    setLink(null);
    setCopied(false);
  };

  const onCopy = async () => {
    if (url === null) return;

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setError(null);
    } catch {
      // The Clipboard API is unavailable outside secure contexts and can be
      // denied by permission policy. The field next to this button is a real,
      // selectable input holding the full URL, so there is a manual path — say
      // so rather than failing silently or pretending it worked.
      setError("Couldn’t copy automatically. Select the link above and copy it.");
    }
  };

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="outline">
            <Share2 />
            Share
          </Button>
        }
      />

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share a preview</DialogTitle>
          <DialogDescription>
            A private link to your draft as it looks right now. Anyone with the link can view it —
            no account needed — and nobody can edit anything through it.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {url === null || link === null ? (
          <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-6 text-center">
            <div className="flex w-full flex-col items-center gap-2">
              <Link2 className="size-6 text-muted-foreground" aria-hidden />
              <p className="text-sm text-muted-foreground">
                You don’t have a preview link yet. Your draft stays private until you create one.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={url}
                aria-label="Preview link"
                // Selecting on focus makes the manual copy path a keyboard
                // action rather than a drag: tab in, Ctrl+C, done.
                onFocus={(event) => {
                  event.currentTarget.select();
                }}
                className="font-mono text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Copy preview link"
                onClick={() => {
                  void onCopy();
                }}
              >
                {copied ? <Check /> : <Copy />}
              </Button>
            </div>
            {/* Announced politely so the tick isn't the only feedback — it is
                invisible to a screen reader and to anyone not looking at it. */}
            <p aria-live="polite" className="text-xs text-muted-foreground">
              {copied ? "Copied to clipboard." : `Created ${formatDate(link.createdAt)}.`}
            </p>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {link === null
            ? "The link shows your current draft, including changes you make after sharing it. Search engines are told not to index it."
            : "Replacing or turning off the link stops the current one working immediately, for everyone you have shared it with."}
        </p>

        <DialogFooter>
          <DialogClose render={<Button variant="ghost">Done</Button>} />

          {link === null ? (
            <Button
              disabled={pending !== null}
              onClick={() => {
                void onIssue();
              }}
            >
              {pending === "issue" ? <Spinner /> : <Link2 />}
              {pending === "issue" ? "Creating…" : "Create preview link"}
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                disabled={pending !== null}
                onClick={() => {
                  void onRevoke();
                }}
              >
                {pending === "revoke" ? <Spinner /> : null}
                {pending === "revoke" ? "Turning off…" : "Turn off link"}
              </Button>
              <Button
                disabled={pending !== null}
                onClick={() => {
                  void onIssue();
                }}
              >
                {pending === "issue" ? <Spinner /> : <RefreshCw />}
                {pending === "issue" ? "Replacing…" : "Replace link"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
