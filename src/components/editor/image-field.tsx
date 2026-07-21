"use client";

import { useCallback, useId, useRef, useState } from "react";
import { AlertCircle, ImageUp, Loader2, Trash2 } from "lucide-react";

import {
  attachImageAction,
  createImageUploadTicketAction,
  removeImageAction,
} from "@/app/(app)/dashboard/events/[eventId]/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { ACCEPTED_IMAGE_CONTENT_TYPES, MAX_IMAGE_BYTES } from "@/config/limits";
import { ACCEPTED_FORMATS_LABEL, IMAGE_SLOTS } from "@/config/media";
import type { ImageRef } from "@/content/event-content";
import { cloudinaryUrl } from "@/lib/cloudinary-url";
import { domainErrorMessage } from "@/lib/form-errors";
import type { ImageSlot } from "@/server/services/media-service";

/**
 * The one image control, used by every slot (task 5.4).
 *
 * Upload, replace, remove, and the error states for each. Written once because
 * there are five consumers — hero, venue, speaker, team, sponsor — and five
 * copies of a three-step upload flow is five places for the validation rules to
 * drift apart.
 *
 * ## Why this isn't part of the autosave forms
 *
 * Images don't debounce. There is no "still typing" state for a file picker:
 * the user chooses a file and the work should start immediately, and the result
 * is a single atomic change rather than a field that keeps evolving. So this
 * component owns its own request lifecycle and reports the resulting
 * `updatedAt` upward, rather than being a field inside a `useAutosave` form.
 */

/**
 * Reuses the content contract's own image shape rather than declaring a
 * parallel one — this control's whole job is to produce a value the serializer
 * will eventually emit as an `ImageRef`.
 */
type ImageValue = ImageRef;

export function ImageField({
  eventId,
  slot,
  value,
  onChange,
  label,
  disabled = false,
}: {
  eventId: string;
  slot: ImageSlot;
  value: ImageValue | null;
  /** Called after a successful upload or removal, with the new value. */
  onChange: (value: ImageValue | null) => void;
  /** Overrides the slot's default label, for rows that name themselves. */
  label?: string;
  disabled?: boolean;
}) {
  const spec = IMAGE_SLOTS[slot.kind];
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const upload = useCallback(
    async (file: File) => {
      setError(null);
      setWarning(null);

      // Client-side pre-checks. Both are re-done server-side against
      // Cloudinary's own reading of the file — these exist only so the user
      // finds out now rather than after pushing 10 MB up a phone connection.
      if (!ACCEPTED_IMAGE_CONTENT_TYPES.includes(file.type as never)) {
        setError(`That file type isn't supported. Use ${ACCEPTED_FORMATS_LABEL}.`);
        return;
      }

      if (file.size > MAX_IMAGE_BYTES) {
        setError(
          `That image is ${(file.size / (1024 * 1024)).toFixed(1)} MB — the limit is ${
            MAX_IMAGE_BYTES / (1024 * 1024)
          } MB.`,
        );
        return;
      }

      setBusy(true);

      try {
        const ticket = await createImageUploadTicketAction(eventId, slot);
        if (!ticket.ok) {
          setError(domainErrorMessage(ticket.error));
          return;
        }

        const form = new FormData();
        for (const [key, fieldValue] of Object.entries(ticket.value.fields)) {
          form.append(key, fieldValue);
        }
        form.append("file", file);

        const uploaded = await fetch(ticket.value.url, { method: "POST", body: form });
        if (!uploaded.ok) {
          setError("The upload didn't go through. Please try again.");
          return;
        }

        // The response is read only for the public id, and even that is
        // re-verified server-side — `attachImage` looks the asset up itself
        // rather than believing anything reported here.
        const result = (await uploaded.json()) as { public_id?: string };
        if (typeof result.public_id !== "string") {
          setError("The upload didn't go through. Please try again.");
          return;
        }

        const attached = await attachImageAction(eventId, {
          slot,
          publicId: result.public_id,
        });

        if (!attached.ok) {
          setError(domainErrorMessage(attached.error));
          return;
        }

        if (attached.value.width < spec.recommendedMinWidth) {
          setWarning(
            `This image is ${attached.value.width}px wide. At least ${spec.recommendedMinWidth}px will look sharper on large screens.`,
          );
        }

        onChange({
          cloudinaryPublicId: attached.value.publicId,
          width: attached.value.width,
          height: attached.value.height,
        });
      } catch {
        setError("Couldn't reach the server. Please try again.");
      } finally {
        setBusy(false);
        // Clear the input so choosing the *same* file again still fires a
        // change event — otherwise a failed upload can't be retried by
        // reselecting the file that failed.
        if (inputRef.current !== null) inputRef.current.value = "";
      }
    },
    [eventId, slot, spec.recommendedMinWidth, onChange],
  );

  const remove = useCallback(async () => {
    setError(null);
    setWarning(null);
    setBusy(true);

    try {
      const result = await removeImageAction(eventId, { slot });
      if (!result.ok) {
        setError(domainErrorMessage(result.error));
        return;
      }
      onChange(null);
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [eventId, slot, onChange]);

  const previewUrl =
    value === null ? null : cloudinaryUrl(value.cloudinaryPublicId, { width: 480, crop: "limit" });

  return (
    <Field>
      <FieldLabel htmlFor={inputId}>{label ?? spec.label}</FieldLabel>

      <div className="flex flex-wrap items-start gap-4">
        <div
          className="flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-input bg-muted/30"
          style={{ width: 160, height: Math.round(160 / spec.aspectRatio) }}
        >
          {previewUrl === null ? (
            <span className="px-2 text-center text-xs text-muted-foreground">No image</span>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element -- Cloudinary is
               the optimizer here, exactly as in the templates; this is a 160px
               editor thumbnail behind auth, not an LCP candidate. */
            <img
              src={previewUrl}
              alt=""
              className="size-full object-cover"
              width={value?.width}
              height={value?.height}
            />
          )}
        </div>

        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            className="sr-only"
            accept={ACCEPTED_IMAGE_CONTENT_TYPES.join(",")}
            disabled={disabled || busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file !== undefined) void upload(file);
            }}
          />

          <div className="flex flex-wrap items-center gap-2">
            {/*
              The real <input type="file"> is visually hidden rather than
              styled, because its appearance can't be controlled
              cross-browser. It stays focusable and labelled, so keyboard and
              screen-reader users get the native control; this button just
              forwards a click to it.
            */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || busy}
              onClick={() => inputRef.current?.click()}
            >
              {busy ? <Loader2 className="animate-spin" /> : <ImageUp />}
              {busy ? "Uploading…" : value === null ? "Upload image" : "Replace"}
            </Button>

            {value === null ? null : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled || busy}
                onClick={() => void remove()}
              >
                <Trash2 />
                Remove
              </Button>
            )}
          </div>

          <FieldDescription>
            {spec.hint} {ACCEPTED_FORMATS_LABEL}, up to {MAX_IMAGE_BYTES / (1024 * 1024)} MB.
          </FieldDescription>
        </div>
      </div>

      {error === null ? null : (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {warning === null ? null : (
        <Alert>
          <AlertCircle />
          <AlertDescription>{warning}</AlertDescription>
        </Alert>
      )}
    </Field>
  );
}
