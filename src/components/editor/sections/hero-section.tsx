"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { saveHeroAction } from "@/app/(app)/dashboard/events/[eventId]/actions";
import { EditorSection } from "@/components/editor/editor-section";
import { useAutosave } from "@/components/editor/use-autosave";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { THEME_MAX_LENGTH } from "@/config/limits";
import {
  heroContentSchema,
  type HeroContentInput,
  type HeroContentValues,
} from "@/lib/validation/content";

/**
 * The hero section's editable content (task 5.3).
 *
 * Two fields with opposite rules, which is why they share a section: the
 * display name is the one thing that can never be blank (FR-15a), and the
 * theme is the clearest example of a blank that is not merely allowed but
 * *designed for* — the hero always renders, so an empty theme is replaced by
 * platform copy rather than leaving a gap (FR-38).
 *
 * The description under the theme field says so explicitly. Without it the
 * field reads as something the user has failed to fill in, and organizers
 * invent a tagline to make the warning feeling go away — which is precisely
 * the outcome the platform default exists to prevent.
 */
export function HeroSection({
  eventId,
  defaultValues,
  initialUpdatedAt,
  onConflict,
}: {
  eventId: string;
  defaultValues: HeroContentInput;
  initialUpdatedAt: Date;
  onConflict: () => void;
}) {
  const form = useForm<HeroContentInput, unknown, HeroContentValues>({
    resolver: zodResolver(heroContentSchema),
    defaultValues,
    mode: "onTouched",
  });

  const { status, saveNow } = useAutosave({
    form,
    initialUpdatedAt,
    onConflict,
    save: (values, expectedUpdatedAt) => saveHeroAction(eventId, { values, expectedUpdatedAt }),
  });

  const { errors } = form.formState;

  return (
    <EditorSection
      id="hero"
      title="Event name and theme"
      description="The first thing visitors see at the top of your site."
      status={status}
      onSaveNow={saveNow}
      error={errors.root?.message}
    >
      <Field data-invalid={Boolean(errors.displayName) || undefined}>
        <FieldLabel htmlFor="hero-displayName">Event name</FieldLabel>
        <Input
          id="hero-displayName"
          aria-invalid={Boolean(errors.displayName)}
          aria-describedby={
            errors.displayName ? "hero-displayName-error" : "hero-displayName-description"
          }
          {...form.register("displayName")}
        />
        {errors.displayName ? (
          <FieldError id="hero-displayName-error">{errors.displayName.message}</FieldError>
        ) : (
          <FieldDescription id="hero-displayName-description">
            Shown in your site&rsquo;s header, hero, and page title. Letters, spaces, and hyphens —
            no numbers.
          </FieldDescription>
        )}
      </Field>

      <Field data-invalid={Boolean(errors.theme) || undefined}>
        <FieldLabel htmlFor="hero-theme">Theme or tagline (optional)</FieldLabel>
        <Input
          id="hero-theme"
          maxLength={THEME_MAX_LENGTH}
          placeholder="Ideas worth spreading, close to home"
          aria-invalid={Boolean(errors.theme)}
          aria-describedby={errors.theme ? "hero-theme-error" : "hero-theme-description"}
          {...form.register("theme")}
        />
        {errors.theme ? (
          <FieldError id="hero-theme-error">{errors.theme.message}</FieldError>
        ) : (
          <FieldDescription id="hero-theme-description">
            {/*
              The apostrophe below is a literal ’, not `&rsquo;`, and that is
              load-bearing. A JSX text chunk that follows an expression
              container loses its leading space if the chunk contains an HTML
              entity — this line rendered as "up to 100characters". Verified
              both ways in the browser: removing the entity fixes it, putting
              it back breaks it again. `{" "}` also fixes it, but Prettier
              deletes the explicit space on the next format run, so the literal
              character is the only stable fix. See CLAUDE.md.
            */}
            A short phrase under your event name, up to {THEME_MAX_LENGTH} characters. Leave it
            blank and we’ll show a polished default line instead — your hero will never look empty.
          </FieldDescription>
        )}
      </Field>
    </EditorSection>
  );
}
