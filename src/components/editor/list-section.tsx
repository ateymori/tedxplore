"use client";

import { useState } from "react";
import { AlertCircle, ChevronDown, ChevronUp, GripVertical, Plus, Trash2 } from "lucide-react";

import { SaveStatusIndicator } from "@/components/editor/save-status-indicator";
import type { SaveStatus } from "@/components/editor/use-autosave";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * The container and row chrome for the four list sections (task 5.5).
 *
 * ## Reordering is buttons first, drag second
 *
 * The plan asks for a drag handle, and there is one — but the *primary*
 * mechanism is a pair of move up/down buttons, because the HTML5 drag-and-drop
 * API is unusable from a keyboard and this project's definition of done
 * requires keyboard access on every task. Both paths call the same reorder,
 * so they cannot disagree.
 *
 * That also avoids a dependency. A real drag library (`@dnd-kit`) would give
 * better pointer ergonomics and proper drag announcements, but it is a
 * substantial addition for a list capped at 30 rows where the accessible path
 * has to exist anyway. Worth revisiting if organizers report the buttons are
 * tedious — the seam is this file alone.
 */

export function ListSection({
  id,
  title,
  description,
  count,
  limit,
  error,
  adding,
  atLimit,
  addLabel,
  onAdd,
  emptyState,
  children,
}: {
  id: string;
  title: string;
  description?: React.ReactNode;
  count: number;
  limit: number;
  error: string | null;
  adding: boolean;
  atLimit: boolean;
  addLabel: string;
  onAdd: () => void;
  emptyState: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <Card className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            {description === undefined ? null : (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            {count} of {limit}
          </span>
        </div>

        {error === null ? null : (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/*
          An empty list is a normal, common draft state (FR-15a) — never an
          error, and never styled as a warning. The copy says what to do next
          and what happens if you don't.
        */}
        {count === 0 ? (
          <div className="rounded-lg border border-dashed border-input px-6 py-8 text-center text-sm text-muted-foreground">
            {emptyState}
          </div>
        ) : (
          <ul className="flex flex-col gap-4">{children}</ul>
        )}

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={adding || atLimit}
            onClick={onAdd}
          >
            <Plus />
            {adding ? "Adding…" : addLabel}
          </Button>
          {atLimit ? (
            <span className="text-xs text-muted-foreground">
              You&rsquo;ve reached the maximum of {limit}.
            </span>
          ) : null}
        </div>
      </Card>
    </section>
  );
}

/**
 * One row: the reorder controls, a delete button, and the section's own fields.
 *
 * The row is a `<form>` for the same reason the non-list sections are — Enter
 * in a text input must flush rather than reload the page — but its reorder and
 * delete buttons are `type="button"` so they never submit it.
 */
export function ListRow({
  index,
  total,
  title,
  status,
  onSaveNow,
  onMove,
  onMoveTo,
  onRemove,
  removeLabel,
  error,
  children,
}: {
  index: number;
  total: number;
  /** Announced on the reorder controls, so they aren't five identical buttons. */
  title: string;
  status: SaveStatus;
  onSaveNow: () => void;
  onMove: (direction: -1 | 1) => void;
  onMoveTo: (toIndex: number) => void;
  onRemove: () => void;
  removeLabel: string;
  error?: string;
  children: React.ReactNode;
}) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <li
      // Native HTML5 drag, for pointer users only — see the module comment.
      // `dragOver` drives the drop indicator; the actual move happens on drop.
      onDragOver={(event) => {
        event.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragOver(false);
        const from = Number(event.dataTransfer.getData("text/plain"));
        if (Number.isInteger(from)) onMoveTo(index);
      }}
      className={cn(
        "rounded-lg border border-input transition-colors",
        dragOver && "border-primary bg-accent/40",
      )}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSaveNow();
        }}
        noValidate
        className="flex flex-col gap-4 p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex items-center gap-1">
            <span
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData("text/plain", String(index));
                event.dataTransfer.effectAllowed = "move";
              }}
              // Hidden from assistive tech: it does nothing without a pointer,
              // and the two buttons beside it are the accessible equivalent.
              aria-hidden="true"
              className="cursor-grab p-1 text-muted-foreground active:cursor-grabbing"
            >
              <GripVertical className="size-4" />
            </span>

            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={index === 0}
              onClick={() => onMove(-1)}
              aria-label={`Move ${title} up`}
            >
              <ChevronUp />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={index === total - 1}
              onClick={() => onMove(1)}
              aria-label={`Move ${title} down`}
            >
              <ChevronDown />
            </Button>

            <span className="ml-1 text-xs text-muted-foreground">
              {index + 1} of {total}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <SaveStatusIndicator status={status} onSaveNow={onSaveNow} />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onRemove}
              aria-label={removeLabel}
            >
              <Trash2 />
            </Button>
          </div>
        </div>

        {error === undefined ? null : (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-4">{children}</div>
      </form>
    </li>
  );
}
