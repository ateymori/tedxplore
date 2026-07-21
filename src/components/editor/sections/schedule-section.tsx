"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { saveScheduleAction } from "@/app/(app)/dashboard/events/[eventId]/actions";
import { EditorSection } from "@/components/editor/editor-section";
import { useAutosave } from "@/components/editor/use-autosave";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { supportedTimeZones } from "@/lib/datetime";
import {
  scheduleContentSchema,
  type ScheduleContentInput,
  type ScheduleContentValues,
} from "@/lib/validation/content";

/**
 * Event date, time, and timezone (task 5.3).
 *
 * The timezone is a real field rather than an assumption, because the value
 * being captured is "6pm *in Toronto*" — the organizer may well be filling
 * this in from another country, and a countdown that silently used the
 * submitting browser's zone would be wrong by hours on the visitor's screen
 * with nothing on the page to reveal it. The server does the conversion to an
 * absolute instant (see `scheduleContentSchema`).
 *
 * Both fields may stay blank indefinitely (FR-15a) — the date is one of the
 * last things a TEDx team pins down — in which case the countdown section
 * simply doesn't render (BR-13).
 */
export function ScheduleSection({
  eventId,
  defaultValues,
  initialUpdatedAt,
  onConflict,
}: {
  eventId: string;
  defaultValues: ScheduleContentInput;
  initialUpdatedAt: Date;
  onConflict: () => void;
}) {
  const form = useForm<ScheduleContentInput, unknown, ScheduleContentValues>({
    resolver: zodResolver(scheduleContentSchema),
    defaultValues,
    mode: "onTouched",
  });

  const { status, saveNow } = useAutosave({
    form,
    initialUpdatedAt,
    onConflict,
    save: (values, expectedUpdatedAt) => saveScheduleAction(eventId, { values, expectedUpdatedAt }),
  });

  const { errors } = form.formState;

  // Built once: ~400 entries, and rebuilding on every keystroke elsewhere in
  // the form would re-render the whole option list.
  const timeZones = useMemo(
    () => supportedTimeZones(defaultValues.timezone),
    [defaultValues.timezone],
  );

  return (
    <EditorSection
      id="schedule"
      title="Date and time"
      description="Drives the countdown on your site."
      status={status}
      onSaveNow={saveNow}
      error={errors.root?.message}
    >
      <Field data-invalid={Boolean(errors.eventDate) || undefined}>
        <FieldLabel htmlFor="schedule-date">Event date and start time</FieldLabel>
        <Input
          id="schedule-date"
          type="datetime-local"
          aria-invalid={Boolean(errors.eventDate)}
          aria-describedby={errors.eventDate ? "schedule-date-error" : "schedule-date-description"}
          {...form.register("eventDate")}
        />
        {errors.eventDate ? (
          <FieldError id="schedule-date-error">{errors.eventDate.message}</FieldError>
        ) : (
          <FieldDescription id="schedule-date-description">
            Optional. Leave blank until your date is confirmed — the countdown stays hidden until
            then.
          </FieldDescription>
        )}
      </Field>

      <Field data-invalid={Boolean(errors.timezone) || undefined}>
        <FieldLabel htmlFor="schedule-timezone">Timezone</FieldLabel>
        <NativeSelect
          id="schedule-timezone"
          aria-invalid={Boolean(errors.timezone)}
          aria-describedby={
            errors.timezone ? "schedule-timezone-error" : "schedule-timezone-description"
          }
          {...form.register("timezone")}
        >
          <option value="">Select a timezone…</option>
          {timeZones.map((zone) => (
            <option key={zone} value={zone}>
              {zone.replaceAll("_", " ")}
            </option>
          ))}
        </NativeSelect>
        {errors.timezone ? (
          <FieldError id="schedule-timezone-error">{errors.timezone.message}</FieldError>
        ) : (
          <FieldDescription id="schedule-timezone-description">
            Your event&rsquo;s local timezone — the time above is shown to visitors in this zone,
            wherever they are.
          </FieldDescription>
        )}
      </Field>
    </EditorSection>
  );
}
