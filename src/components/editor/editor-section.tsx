"use client";

import { AlertCircle } from "lucide-react";

import { SaveStatusIndicator } from "@/components/editor/save-status-indicator";
import type { SaveStatus } from "@/components/editor/use-autosave";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

/**
 * The frame every editor section renders inside (task 5.1).
 *
 * Purely presentational: it owns the heading, the anchor the section nav
 * scrolls to, the status indicator, and the form-level error slot. The section
 * itself supplies only its fields, so a new section is a schema, an action, and
 * a list of inputs — never a re-implementation of the chrome.
 *
 * It renders a real `<form>` with no submit handler of its own. Autosave is the
 * save path, and "Save now" is a button that calls it directly; but pressing
 * Enter in a text input still fires submit, and an unhandled submit would
 * reload the page and lose the debounce window's worth of typing. Catching it
 * here and flushing instead turns that reflex into exactly what the user meant.
 */
export function EditorSection({
  id,
  title,
  description,
  status,
  onSaveNow,
  error,
  children,
}: {
  /** Doubles as the nav anchor target. */
  id: string;
  title: string;
  description?: React.ReactNode;
  status: SaveStatus;
  onSaveNow: () => void;
  /** The form-level (`root`) message, when the save itself failed. */
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <form
      // `scroll-mt` keeps the heading clear of the sticky page header when the
      // nav jumps here; without it the title lands underneath it.
      id={id}
      className="scroll-mt-24"
      onSubmit={(event) => {
        event.preventDefault();
        onSaveNow();
      }}
      noValidate
    >
      <Card className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            {description === undefined ? null : (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          <SaveStatusIndicator status={status} onSaveNow={onSaveNow} className="shrink-0" />
        </div>

        {error === undefined ? null : (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-5">{children}</div>
      </Card>
    </form>
  );
}
