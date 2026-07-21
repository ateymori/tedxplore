"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { saveRegistrationAction } from "@/app/(app)/dashboard/events/[eventId]/actions";
import { EditorSection } from "@/components/editor/editor-section";
import { useAutosave } from "@/components/editor/use-autosave";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { registrationContentSchema, type RegistrationContentInput } from "@/lib/validation/content";

/**
 * Where visitors go to get a ticket (task 5.3).
 *
 * A link out, not a ticketing integration — selling tickets is explicitly out
 * of scope for V1, and every TEDx team already has a platform they use. With
 * no URL set, the site's registration calls to action don't render at all
 * (BR-13) rather than pointing nowhere.
 */
export function RegistrationSection({
  eventId,
  defaultValues,
  initialUpdatedAt,
  onConflict,
}: {
  eventId: string;
  defaultValues: RegistrationContentInput;
  initialUpdatedAt: Date;
  onConflict: () => void;
}) {
  const form = useForm<RegistrationContentInput>({
    resolver: zodResolver(registrationContentSchema),
    defaultValues,
    mode: "onTouched",
  });

  const { status, saveNow } = useAutosave({
    form,
    initialUpdatedAt,
    onConflict,
    save: (values, expectedUpdatedAt) =>
      saveRegistrationAction(eventId, { values, expectedUpdatedAt }),
  });

  const { errors } = form.formState;

  return (
    <EditorSection
      id="registration"
      title="Registration"
      description="Where your “Get tickets” buttons point."
      status={status}
      onSaveNow={saveNow}
      error={errors.root?.message}
    >
      <Field data-invalid={Boolean(errors.registrationUrl) || undefined}>
        <FieldLabel htmlFor="registration-url">Registration or ticket link</FieldLabel>
        <Input
          id="registration-url"
          type="url"
          inputMode="url"
          placeholder="https://…"
          aria-invalid={Boolean(errors.registrationUrl)}
          aria-describedby={
            errors.registrationUrl ? "registration-url-error" : "registration-url-description"
          }
          {...form.register("registrationUrl")}
        />
        {errors.registrationUrl ? (
          <FieldError id="registration-url-error">{errors.registrationUrl.message}</FieldError>
        ) : (
          <FieldDescription id="registration-url-description">
            Optional. Link to wherever you sell or register tickets — Eventbrite, a Google Form,
            your own page. Without one, the registration buttons stay hidden.
          </FieldDescription>
        )}
      </Field>
    </EditorSection>
  );
}
