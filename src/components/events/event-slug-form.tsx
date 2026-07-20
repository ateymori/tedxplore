"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, Lock } from "lucide-react";

import { changeEventSlugAction } from "@/app/(app)/dashboard/events/actions";
import {
  SlugAvailabilityHint,
  SlugUrlPreview,
  normalizeSlugInput,
  slugInputProps,
  useSlugAvailability,
} from "@/components/events/slug-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { tedxSitePath } from "@/config/site";
import { domainErrorToFormErrors, ROOT_ERROR_FIELD } from "@/lib/form-errors";
import { changeSlugSchema } from "@/lib/validation/event";

type SlugFormValues = { slug: string };

/**
 * The web address, editable only before first publication (BR-5, task 3.3).
 *
 * When locked, the field is replaced by a read-only display rather than a
 * disabled input: a disabled control invites the user to work out how to
 * enable it, while a plain statement of the rule answers the question. The
 * server enforces the lock regardless — this component never gates anything.
 */
export function EventSlugForm({
  eventId,
  slug,
  editable,
}: {
  eventId: string;
  slug: string;
  editable: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);

  const form = useForm<SlugFormValues>({
    resolver: zodResolver(changeSlugSchema),
    defaultValues: { slug },
  });

  const { errors, isSubmitting } = form.formState;
  // `useWatch` rather than `form.watch()` — the latter returns a fresh function
  // each render, which React's compiler can't memoize safely.
  const currentSlug = useWatch({ control: form.control, name: "slug" });

  // Skip the availability check while the value is still the event's own slug
  // — it is "taken", by this event, and saying so would be nonsense.
  const availability = useSlugAvailability(currentSlug, { skip: currentSlug === slug });

  const onSubmit = form.handleSubmit(async (values) => {
    setSaved(false);
    const result = await changeEventSlugAction(eventId, values);

    if (!result.ok) {
      for (const { field, message } of domainErrorToFormErrors(result.error)) {
        form.setError(field as keyof SlugFormValues | typeof ROOT_ERROR_FIELD, { message });
      }
      return;
    }

    form.reset({ slug: result.value.slug });
    setSaved(true);
    router.refresh();
  });

  if (!editable) {
    return (
      <div className="flex flex-col gap-2">
        <p className="font-mono text-sm">{tedxSitePath(slug)}</p>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Lock className="size-3.5 shrink-0" />
          Locked. A site&rsquo;s address is fixed once it has been published, so existing links keep
          working.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {errors.root ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{errors.root.message}</AlertDescription>
        </Alert>
      ) : null}

      <Field data-invalid={Boolean(errors.slug) || undefined}>
        <FieldLabel htmlFor="slug">Web address</FieldLabel>
        <Input
          id="slug"
          {...slugInputProps}
          name="slug"
          value={currentSlug}
          onChange={(event) => {
            form.setValue("slug", normalizeSlugInput(event.target.value), {
              shouldValidate: form.formState.isSubmitted,
            });
          }}
          onBlur={() => {
            void form.trigger("slug");
          }}
          aria-invalid={Boolean(errors.slug)}
          aria-describedby={errors.slug ? "slug-error" : "slug-preview"}
        />
        <div id="slug-preview">
          <SlugUrlPreview slug={currentSlug} />
        </div>
        {errors.slug ? (
          <FieldError id="slug-error">{errors.slug.message}</FieldError>
        ) : (
          <SlugAvailabilityHint state={availability} />
        )}
        <FieldDescription>
          You can change this until the site is published for the first time. After that it is fixed
          permanently.
        </FieldDescription>
      </Field>

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          disabled={isSubmitting || currentSlug === slug || availability === "taken"}
        >
          {isSubmitting ? "Saving…" : "Change address"}
        </Button>
        <span aria-live="polite" className="text-sm text-muted-foreground">
          {saved && currentSlug === slug ? (
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5" />
              Saved
            </span>
          ) : null}
        </span>
      </div>
    </form>
  );
}
