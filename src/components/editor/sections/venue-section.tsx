"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { saveVenueAction } from "@/app/(app)/dashboard/events/[eventId]/actions";
import { EditorSection } from "@/components/editor/editor-section";
import { useAutosave } from "@/components/editor/use-autosave";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CONTENT_TEXT_LIMITS, venueContentSchema } from "@/lib/validation/content";
import type { VenueContentInput } from "@/lib/validation/content";

/**
 * Where the event happens (task 5.6).
 *
 * Any one of these three fields is enough to make the section worth showing —
 * an address with no name still helps an attendee get there — which is why
 * `sectionVisibility` ORs them rather than requiring a complete venue.
 */
export function VenueSection({
  eventId,
  defaultValues,
  initialUpdatedAt,
  onConflict,
}: {
  eventId: string;
  defaultValues: VenueContentInput;
  initialUpdatedAt: Date;
  onConflict: () => void;
}) {
  const form = useForm<VenueContentInput>({
    resolver: zodResolver(venueContentSchema),
    defaultValues,
    mode: "onTouched",
  });

  const { status, saveNow } = useAutosave({
    form,
    initialUpdatedAt,
    onConflict,
    save: (values, expectedUpdatedAt) => saveVenueAction(eventId, { values, expectedUpdatedAt }),
  });

  const { errors } = form.formState;

  return (
    <EditorSection
      id="venue"
      title="Venue"
      description="Where your event takes place."
      status={status}
      onSaveNow={saveNow}
      error={errors.root?.message}
    >
      <Field data-invalid={Boolean(errors.venueName) || undefined}>
        <FieldLabel htmlFor="venue-name">Venue name</FieldLabel>
        <Input
          id="venue-name"
          maxLength={CONTENT_TEXT_LIMITS.venueName}
          placeholder="Pollack Hall"
          aria-invalid={Boolean(errors.venueName)}
          aria-describedby={errors.venueName ? "venue-name-error" : undefined}
          {...form.register("venueName")}
        />
        {errors.venueName ? (
          <FieldError id="venue-name-error">{errors.venueName.message}</FieldError>
        ) : null}
      </Field>

      <Field data-invalid={Boolean(errors.venueAddress) || undefined}>
        <FieldLabel htmlFor="venue-address">Address</FieldLabel>
        <Input
          id="venue-address"
          maxLength={CONTENT_TEXT_LIMITS.venueAddress}
          placeholder="555 Sherbrooke St W, Montreal, QC"
          aria-invalid={Boolean(errors.venueAddress)}
          aria-describedby={errors.venueAddress ? "venue-address-error" : undefined}
          {...form.register("venueAddress")}
        />
        {errors.venueAddress ? (
          <FieldError id="venue-address-error">{errors.venueAddress.message}</FieldError>
        ) : null}
      </Field>

      <Field data-invalid={Boolean(errors.venueDescription) || undefined}>
        <FieldLabel htmlFor="venue-description">Directions or notes</FieldLabel>
        <Textarea
          id="venue-description"
          rows={4}
          maxLength={CONTENT_TEXT_LIMITS.venueDescription}
          placeholder="Parking, accessible entrances, the nearest metro station…"
          aria-invalid={Boolean(errors.venueDescription)}
          aria-describedby={
            errors.venueDescription ? "venue-description-error" : "venue-description-description"
          }
          {...form.register("venueDescription")}
        />
        {errors.venueDescription ? (
          <FieldError id="venue-description-error">{errors.venueDescription.message}</FieldError>
        ) : (
          <FieldDescription id="venue-description-description">
            All three fields are optional — fill in whichever you have. The venue section is hidden
            until at least one is set.
          </FieldDescription>
        )}
      </Field>
    </EditorSection>
  );
}
