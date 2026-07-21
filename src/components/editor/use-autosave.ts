"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWatch, type FieldValues, type UseFormReturn } from "react-hook-form";

import { domainErrorToFormErrors, ROOT_ERROR_FIELD } from "@/lib/form-errors";
import type { ContentSaveResult } from "@/server/services/content-service";
import type { Result } from "@/server/services/result";

/**
 * The autosave engine (task 5.2).
 *
 * One hook drives every section of the editor: watch the form, wait for the
 * user to stop typing, validate, save, and report what happened. Sections
 * differ only in their schema and their action, so putting the machinery here
 * means the "Saving…/Saved/Save failed" contract (FR-16) is implemented once
 * and cannot drift between the venue form and the hero form.
 *
 * ## Why the status has five states, not three
 *
 * `unsaved` and `error` look similar — neither means the work is safe — but
 * they call for different words and a different recovery. `unsaved` is the
 * normal state a second after typing and needs no alarm; `error` means the
 * server refused and the user should know their work is only in this tab.
 * Collapsing them would make the indicator either permanently alarming or
 * uselessly quiet.
 */
export type SaveStatus = "idle" | "unsaved" | "saving" | "saved" | "error";

/**
 * What the *save operation* is doing — the only part that is genuinely state.
 *
 * `unsaved` is deliberately absent: it means "the form differs from what the
 * server has", which React Hook Form already tracks as `isDirty`. Storing it
 * separately would mean keeping two sources of truth in step through every
 * keystroke, every reset, and every failed save — and the way you keep them in
 * step is a `setState` inside an effect, which is both a cascading render and a
 * standing invitation for the indicator to disagree with the form. The public
 * `SaveStatus` is derived from these two at the bottom of the hook instead.
 */
type SaveState = "idle" | "saving" | "saved" | "error";

/** FR-16: long enough not to fire per keystroke, short enough to feel automatic. */
const DEBOUNCE_MS = 1500;

/**
 * A failed save retries once, automatically, after this long.
 *
 * One retry, not an escalating chain: the overwhelmingly common cause is a
 * dropped connection or a redeploy mid-request, which a single retry a few
 * seconds later resolves. Anything that survives that is a real failure the
 * user needs to see rather than have hidden behind a spinner that keeps
 * promising — and "Save now" is right there.
 */
const RETRY_MS = 4000;

/**
 * Generic over all three of React Hook Form's parameters, not just the field
 * values. A schema whose output type differs from its input — the schedule
 * section's wall-time string becomes a `Date` — produces a
 * `UseFormReturn<In, _, Out>` that is not assignable to `UseFormReturn<In>`,
 * so narrowing to the field values alone would lock that section out of
 * autosave entirely.
 */
export interface UseAutosaveOptions<
  T extends FieldValues,
  TContext,
  TTransformed extends FieldValues,
> {
  form: UseFormReturn<T, TContext, TTransformed>;
  /**
   * Performs the save. Receives the validated values and the concurrency token
   * this client last saw.
   */
  save: (values: T, expectedUpdatedAt: Date | null) => Promise<Result<ContentSaveResult>>;
  /** The event's `updatedAt` at page load — this client's starting token. */
  initialUpdatedAt: Date;
  /**
   * Called after a save that another session had written before. The editor
   * shell shows one shared warning rather than one per section.
   */
  onConflict?: () => void;
}

export interface UseAutosaveResult {
  status: SaveStatus;
  /** Flushes any pending change immediately — backs the "Save now" button. */
  saveNow: () => void;
  /** True while a change is pending, in flight, or failed. */
  hasUnsavedWork: boolean;
}

export function useAutosave<T extends FieldValues, TContext, TTransformed extends FieldValues>({
  form,
  save,
  initialUpdatedAt,
  onConflict,
}: UseAutosaveOptions<T, TContext, TTransformed>): UseAutosaveResult {
  const [saveState, setSaveState] = useState<SaveState>("idle");

  // The concurrency token, in a ref rather than state: it changes on every
  // save and nothing renders from it, so making it state would re-render the
  // whole section for a value only the next request reads.
  const tokenRef = useRef<Date>(initialUpdatedAt);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retriedRef = useRef(false);
  // Guards against two saves overlapping: a slow request plus an eager "Save
  // now" would otherwise race, and the loser would write with a stale token.
  const inFlightRef = useRef(false);

  const values = useWatch({ control: form.control }) as T;

  /**
   * `save` and `onConflict` are held in refs so a caller that rebuilds them
   * each render doesn't restart the debounce timer — but the refs are synced
   * in effects rather than assigned during render. Mutating a ref mid-render
   * is what the React Compiler lint rules forbid, and rightly: the assignment
   * would be discarded if the render were thrown away. Effects run before any
   * timer this hook sets can fire, so nothing ever reads a stale value.
   */
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  const onConflictRef = useRef(onConflict);
  useEffect(() => {
    onConflictRef.current = onConflict;
  }, [onConflict]);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Declared before `flush` so the retry path can reach it, and populated
  // immediately after — `flush` and `scheduleRetry` are mutually recursive, and
  // routing one direction through a ref is what keeps both of them stable
  // callbacks instead of a pair that re-creates each other every render.
  const flushRef = useRef<() => Promise<void>>(async () => {});

  const scheduleRetry = useCallback(() => {
    if (retriedRef.current) return;
    retriedRef.current = true;

    clearTimer();
    timerRef.current = setTimeout(() => {
      void flushRef.current();
    }, RETRY_MS);
  }, [clearTimer]);

  /**
   * Validate, then save.
   *
   * Validation failures leave the status at `unsaved` on purpose. The user is
   * mid-thought with an empty required field; flashing "Save failed" at them
   * would be a lie — nothing was attempted — and the inline field error already
   * says exactly what is wrong.
   */
  const flush = useCallback(async () => {
    clearTimer();

    if (inFlightRef.current) return;

    const valid = await form.trigger();
    if (!valid) {
      setSaveState("idle");
      return;
    }

    inFlightRef.current = true;
    setSaveState("saving");

    // Snapshot the values being sent. The user keeps typing during the
    // request, so re-reading them afterwards would re-baseline the form
    // against text the server never received — silently losing it.
    const sent = form.getValues();

    let result: Result<ContentSaveResult>;
    try {
      result = await saveRef.current(sent, tokenRef.current);
    } catch {
      // A thrown action is a transport failure (offline, deploy mid-flight),
      // not a domain outcome — the same user-visible state as a refusal.
      inFlightRef.current = false;
      setSaveState("error");
      form.setError(ROOT_ERROR_FIELD, {
        message: "Couldn't reach the server. Your changes are still here — retrying…",
      });
      scheduleRetry();
      return;
    }

    inFlightRef.current = false;

    if (!result.ok) {
      setSaveState("error");
      for (const { field, message } of domainErrorToFormErrors(result.error)) {
        form.setError(field as never, { message });
      }
      // Only transport-shaped failures are worth retrying. Re-sending input the
      // server has already rejected would just fail again, and would overwrite
      // the field errors the user is reading.
      if (result.error.type !== "VALIDATION_FAILED") scheduleRetry();
      return;
    }

    retriedRef.current = false;
    tokenRef.current = result.value.updatedAt;
    form.clearErrors(ROOT_ERROR_FIELD);

    // Re-baseline the *defaults* to what was sent, leaving the on-screen values
    // untouched. `isDirty` is then recomputed as "does the form still differ
    // from what the server has" — which is exactly right whether or not the
    // user kept typing during the request. Resetting to `sent` without
    // `keepValues` would yank their newer keystrokes out of the inputs.
    form.reset(sent, { keepValues: true, keepErrors: true });

    if (result.value.conflicted) onConflictRef.current?.();

    // No need to ask whether they kept typing: `isDirty` was just recomputed
    // against the new defaults, and the derived status reads "unsaved" on its
    // own if it is still true.
    setSaveState("saved");
  }, [clearTimer, form, scheduleRetry]);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  /**
   * The debounce itself.
   *
   * Keyed on the serialized values rather than the object, which `useWatch`
   * rebuilds on every render — depending on the object directly would restart
   * the timer forever and never save. Every field in these forms is a string,
   * a number, or an array of them, so JSON is a faithful identity.
   */
  const serialized = JSON.stringify(values);
  const isDirty = form.formState.isDirty;

  useEffect(() => {
    if (!isDirty) return;

    retriedRef.current = false;

    const timer = setTimeout(() => {
      void flushRef.current();
    }, DEBOUNCE_MS);
    timerRef.current = timer;

    return () => clearTimeout(timer);
  }, [serialized, isDirty]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  /**
   * FR-16's safety net: warn before the tab closes on unsaved work.
   *
   * A debounced editor has a real window — up to 1.5 seconds of typing, longer
   * if a save is failing — where closing the tab loses work the user believes
   * is safe. This is the only honest way to say so.
   */
  /**
   * The five-state indicator (FR-16), derived rather than stored.
   *
   * Order matters: an in-flight or failed save outranks dirtiness, because
   * "Saving…" and "Save failed" are what the user needs to see even though the
   * form is technically also unsaved at that moment.
   */
  const status: SaveStatus =
    saveState === "saving" || saveState === "error"
      ? saveState
      : isDirty
        ? "unsaved"
        : saveState === "saved"
          ? "saved"
          : "idle";

  const hasUnsavedWork = status === "unsaved" || status === "saving" || status === "error";

  useEffect(() => {
    if (!hasUnsavedWork) return;

    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };

    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsavedWork]);

  const saveNow = useCallback(() => {
    retriedRef.current = false;
    void flushRef.current();
  }, []);

  return { status, saveNow, hasUnsavedWork };
}
