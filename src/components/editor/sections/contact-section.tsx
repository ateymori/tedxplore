"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { saveContactAction } from "@/app/(app)/dashboard/events/[eventId]/actions";
import { EditorSection } from "@/components/editor/editor-section";
import { SocialLinksField } from "@/components/editor/social-links-field";
import { useAutosave } from "@/components/editor/use-autosave";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { contactContentSchema, type ContactContentInput } from "@/lib/validation/content";

/**
 * How visitors reach the organizers (task 5.3).
 *
 * Both halves are optional and the section auto-hides when both are empty
 * (BR-13) — a team that would rather not publish an inbox simply doesn't.
 */
export function ContactSection({
  eventId,
  defaultValues,
  initialUpdatedAt,
  onConflict,
}: {
  eventId: string;
  defaultValues: ContactContentInput;
  initialUpdatedAt: Date;
  onConflict: () => void;
}) {
  const form = useForm<ContactContentInput>({
    resolver: zodResolver(contactContentSchema),
    defaultValues,
    mode: "onTouched",
  });

  const { status, saveNow } = useAutosave({
    form,
    initialUpdatedAt,
    onConflict,
    save: (values, expectedUpdatedAt) => saveContactAction(eventId, { values, expectedUpdatedAt }),
  });

  const { errors } = form.formState;

  return (
    <EditorSection
      id="contact"
      title="Contact and social links"
      description="Shown in your site's contact section and footer."
      status={status}
      onSaveNow={saveNow}
      error={errors.root?.message}
    >
      <Field data-invalid={Boolean(errors.contactEmail) || undefined}>
        <FieldLabel htmlFor="contact-email">Contact email</FieldLabel>
        <Input
          id="contact-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="hello@your-event.org"
          aria-invalid={Boolean(errors.contactEmail)}
          aria-describedby={
            errors.contactEmail ? "contact-email-error" : "contact-email-description"
          }
          {...form.register("contactEmail")}
        />
        {errors.contactEmail ? (
          <FieldError id="contact-email-error">{errors.contactEmail.message}</FieldError>
        ) : (
          <FieldDescription id="contact-email-description">
            Optional, and public — use a team address rather than a personal one.
          </FieldDescription>
        )}
      </Field>

      <SocialLinksField
        control={form.control}
        register={form.register}
        name="socialLinks"
        idPrefix="contact-social"
        label="Social links"
        description="Optional. Each link opens in a new tab from your site's footer."
        errorMessage={errors.socialLinks?.message ?? errors.socialLinks?.root?.message}
      />
    </EditorSection>
  );
}
