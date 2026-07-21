"use client";

import { useCallback, useState } from "react";

import { domainErrorMessage } from "@/lib/form-errors";
import type { ContentSaveResult, ListItemResult } from "@/server/services/content-service";
import type { Result } from "@/server/services/result";

/**
 * The add / remove / reorder half of a list section (task 5.5).
 *
 * Deliberately *not* the editing half: each row owns its own form and its own
 * `useAutosave`, because a row is an independent debounced save and hoisting
 * that into a shared array would mean one keystroke re-rendering every row.
 * This hook owns only which rows exist and in what order.
 *
 * ## Optimism, applied unevenly on purpose
 *
 * Reorder and remove apply immediately and roll back on failure: both are
 * instant, reversible, and the user is looking straight at the result, so
 * waiting on a round trip would make the list feel broken.
 *
 * Add does not. A new row has no id until the server assigns one, and inventing
 * a temporary one means every subsequent action on that row has to know whether
 * it is real yet — including the autosave that fires 1.5 seconds later. The
 * button shows a pending state instead, which is honest and about 100ms.
 */

export interface ListItem {
  id: string;
}

export interface UseListEditorOptions<T extends ListItem> {
  initialItems: T[];
  /** Limit from `config/limits.ts` — never restated at the call site. */
  limit: number;
  add: () => Promise<Result<ListItemResult>>;
  remove: (id: string) => Promise<Result<ContentSaveResult>>;
  reorder: (ids: string[]) => Promise<Result<ContentSaveResult>>;
  /** Builds the local row for an id the server just created. */
  createLocal: (id: string) => T;
}

export interface UseListEditorResult<T extends ListItem> {
  items: T[];
  error: string | null;
  adding: boolean;
  atLimit: boolean;
  addItem: () => void;
  removeItem: (id: string) => void;
  moveItem: (id: string, direction: -1 | 1) => void;
  /** Used by drag-and-drop, which knows target indices rather than deltas. */
  moveItemTo: (id: string, toIndex: number) => void;
}

export function useListEditor<T extends ListItem>({
  initialItems,
  limit,
  add,
  remove,
  reorder,
  createLocal,
}: UseListEditorOptions<T>): UseListEditorResult<T> {
  const [items, setItems] = useState<T[]>(initialItems);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const atLimit = items.length >= limit;

  const addItem = useCallback(() => {
    if (adding) return;

    setError(null);
    setAdding(true);

    void (async () => {
      try {
        const result = await add();
        if (!result.ok) {
          setError(domainErrorMessage(result.error));
          return;
        }
        setItems((current) => [...current, createLocal(result.value.id)]);
      } catch {
        setError("Couldn't reach the server. Please try again.");
      } finally {
        setAdding(false);
      }
    })();
  }, [add, adding, createLocal]);

  const removeItem = useCallback(
    (id: string) => {
      setError(null);

      // Read from state rather than a `setItems` updater. An updater must be a
      // pure function of its argument: React may call it twice (StrictMode
      // does, in development), and side effects inside one — a second setState,
      // or the network call below — would fire twice per action.
      //
      // Snapshotting the whole array, not just the removed row, so a failure
      // restores the exact previous *order* rather than re-appending at the end.
      const previous = items;
      setItems(previous.filter((item) => item.id !== id));

      void (async () => {
        try {
          const result = await remove(id);
          if (!result.ok) {
            setItems(previous);
            setError(domainErrorMessage(result.error));
          }
        } catch {
          setItems(previous);
          setError("Couldn't reach the server. Please try again.");
        }
      })();
    },
    [items, remove],
  );

  /**
   * Applies a new order locally, then persists the whole id list.
   *
   * Sending the complete order rather than a move keeps the write idempotent —
   * a retried request cannot apply twice — which is what makes rolling back on
   * failure safe.
   */
  const applyOrder = useCallback(
    (next: T[], previous: T[]) => {
      setItems(next);
      setError(null);

      void (async () => {
        try {
          const result = await reorder(next.map((item) => item.id));
          if (!result.ok) {
            setItems(previous);
            setError(domainErrorMessage(result.error));
          }
        } catch {
          setItems(previous);
          setError("Couldn't reach the server. Please try again.");
        }
      })();
    },
    [reorder],
  );

  const moveItemTo = useCallback(
    (id: string, toIndex: number) => {
      const from = items.findIndex((item) => item.id === id);
      if (from === -1) return;

      // Clamping rather than rejecting: "move up" on the first row is a no-op
      // the user can reach by holding a key, not an error worth reporting.
      const to = Math.max(0, Math.min(items.length - 1, toIndex));
      if (from === to) return;

      const next = [...items];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);

      applyOrder(next, items);
    },
    [items, applyOrder],
  );

  const moveItem = useCallback(
    (id: string, direction: -1 | 1) => {
      const from = items.findIndex((item) => item.id === id);
      if (from === -1) return;
      moveItemTo(id, from + direction);
    },
    [items, moveItemTo],
  );

  return { items, error, adding, atLimit, addItem, removeItem, moveItem, moveItemTo };
}
