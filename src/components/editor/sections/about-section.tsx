"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { saveAboutAction } from "@/app/(app)/dashboard/events/[eventId]/actions";
import { EditorSection } from "@/components/editor/editor-section";
import { useAutosave } from "@/components/editor/use-autosave";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { CONTENT_TEXT_LIMITS, aboutContentSchema } from "@/lib/validation/content";
import type { AboutContentInput } from "@/lib/validation/content";

/**
 * The organizer's own description of their event (task 5.3).
 *
 * Distinct from the About TED and About TEDx blocks, which are platform copy
 * the organizer cannot edit and the template always renders. This section
 * auto-hides entirely when blank (BR-13) — so unlike the theme, there is no
 * fallback to promise, and the description says so plainly rather than
 * implying something will appear.
 */
export function AboutSection({
  eventId,
  defaultValues,
  initialUpdatedAt,
  onConflict,
}: {
  eventId: string;
  defaultValues: AboutContentInput;
  initialUpdatedAt: Date;
  onConflict: () => void;
}) {
  const form = useForm<AboutContentInput>({
    resolver: zodResolver(aboutContentSchema),
    defaultValues,
    mode: "onTouched",
  });

  const { status, saveNow } = useAutosave({
    form,
    initialUpdatedAt,
    onConflict,
    save: (values, expectedUpdatedAt) => saveAboutAction(eventId, { values, expectedUpdatedAt }),
  });

  const { errors } = form.formState;

  return (
    <EditorSection
      id="about"
      title="About your event"
      description="A few paragraphs introducing your event to visitors."
      status={status}
      onSaveNow={saveNow}
      error={errors.root?.message}
    >
      <Field data-invalid={Boolean(errors.aboutText) || undefined}>
        <FieldLabel htmlFor="about-text">Description</FieldLabel>
        <Textarea
          id="about-text"
          rows={8}
          maxLength={CONTENT_TEXT_LIMITS.about}
          placeholder="Tell visitors what your event is about, who it's for, and what they can expect."
          aria-invalid={Boolean(errors.aboutText)}
          aria-describedby={errors.aboutText ? "about-text-error" : "about-text-description"}
          {...form.register("aboutText")}
        />
        {errors.aboutText ? (
          <FieldError id="about-text-error">{errors.aboutText.message}</FieldError>
        ) : (
          <FieldDescription id="about-text-description">
            Optional. If you leave this blank the section is hidden from your site rather than shown
            empty.
          </FieldDescription>
        )}
      </Field>
    </EditorSection>
  );
}
