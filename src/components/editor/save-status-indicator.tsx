"use client";

import { AlertTriangle, Check, CloudUpload, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { SaveStatus } from "@/components/editor/use-autosave";

/**
 * FR-16's status indicator, plus its "Save now" fallback.
 *
 * ## Why this is per-section rather than one global indicator
 *
 * Each section owns its own form and its own autosave, so each knows exactly
 * what it saved and when. A single page-level indicator would have to
 * aggregate those — children reporting status upward into shared state on
 * every keystroke — and would then be able to say "Saved" while the section
 * the user is actually looking at has failed. Showing the status beside the
 * fields it describes is both more accurate and less machinery.
 *
 * `aria-live="polite"` rather than `assertive`: this is ambient reassurance
 * that changes every few seconds, and interrupting a screen-reader user
 * mid-sentence to tell them a draft saved would be hostile. The one state
 * worth more urgency, `error`, is also rendered as a form-level `Alert` by the
 * section itself, which is where the recovery lives.
 */

const PRESENTATION: Record<
  SaveStatus,
  { label: string; icon: React.ReactNode; className: string } | null
> = {
  // Nothing has happened yet — an indicator here would be noise on a page the
  // user just opened.
  idle: null,
  unsaved: {
    label: "Unsaved changes",
    icon: <Pencil className="size-3.5" />,
    className: "text-muted-foreground",
  },
  saving: {
    label: "Saving…",
    icon: <Spinner className="size-3.5" />,
    className: "text-muted-foreground",
  },
  saved: {
    label: "Saved",
    icon: <Check className="size-3.5" />,
    className: "text-muted-foreground",
  },
  error: {
    label: "Save failed",
    icon: <AlertTriangle className="size-3.5" />,
    className: "text-destructive",
  },
};

export function SaveStatusIndicator({
  status,
  onSaveNow,
  className,
}: {
  status: SaveStatus;
  onSaveNow: () => void;
  className?: string;
}) {
  const presentation = PRESENTATION[status];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/*
        The live region is always in the DOM, even when empty. Screen readers
        only announce changes *within* a region that already existed — one
        mounted at the moment its text appears is frequently missed.
      */}
      <span
        aria-live="polite"
        className={cn(
          "flex items-center gap-1.5 text-xs font-medium",
          presentation?.className ?? "text-muted-foreground",
        )}
      >
        {presentation === null ? null : (
          <>
            {presentation.icon}
            {presentation.label}
          </>
        )}
      </span>

      {/*
        "Save now" appears only when there is something to save. A button that
        is visible-but-useless invites the user to wonder whether autosave is
        working; one that appears exactly when work is pending explains itself.
      */}
      {status === "unsaved" || status === "error" ? (
        <Button type="button" variant="outline" size="sm" onClick={onSaveNow}>
          <CloudUpload />
          Save now
        </Button>
      ) : null}
    </div>
  );
}
