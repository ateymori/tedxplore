"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle } from "lucide-react";

import { createEventAction } from "@/app/(app)/dashboard/events/actions";
import {
  SlugAvailabilityHint,
  SlugUrlPreview,
  normalizeSlugInput,
  slugInputProps,
  useSlugAvailability,
} from "@/components/events/slug-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldLabel, FieldTitle } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { DASHBOARD_PATH, eventPath } from "@/config/routes";
import { domainErrorToFormErrors, ROOT_ERROR_FIELD } from "@/lib/form-errors";
import { suggestDisplayName } from "@/lib/validation/display-name";
import { createEventSchema, type CreateEventInput } from "@/lib/validation/event";

/**
 * Event creation (FR-8, task 3.1).
 *
 * The two identity fields are deliberately decoupled in the UI, because they
 * are decoupled in the domain (BR-1..BR-5c): the slug builds the URL and the
 * display name is what people read. The form makes that visible — the slug
 * renders as a URL, the display name renders as a heading — so the difference
 * is legible without the user reading any help text.
 */
export function CreateEventForm({ templateId }: { templateId: string }) {
  const router = useRouter();
  const [navigating, setNavigating] = useState(false);

  const form = useForm<CreateEventInput>({
    resolver: zodResolver(createEventSchema),
    defaultValues: {
      slug: "",
      displayName: "",
      templateId,
      tedEventUrl: "",
      licenseHolderName: "",
      authorizationConfirmed: false,
    },
  });

  const { errors, isSubmitting } = form.formState;
  const pending = isSubmitting || navigating;

  // `useWatch` rather than `form.watch()` — the latter returns a fresh function
  // each render, which React's compiler can't memoize safely.
  const slug = useWatch({ control: form.control, name: "slug" });
  const displayName = useWatch({ control: form.control, name: "displayName" });
  const authorizationConfirmed = useWatch({
    control: form.control,
    name: "authorizationConfirmed",
  });

  const availability = useSlugAvailability(slug);

  const onSlugChange = (value: string) => {
    const next = normalizeSlugInput(value);
    const previousSlug = form.getValues("slug");
    const currentName = form.getValues("displayName");

    form.setValue("slug", next, { shouldValidate: form.formState.isSubmitted });

    /**
     * The suggestion keeps tracking the slug (BR-5c) only while the user
     * hasn't taken ownership of the name — which is derived, not remembered:
     * the name is still "ours" exactly when it is empty or still equals what
     * we suggested for the previous slug. Anything else is the user's writing
     * and must never be overwritten by a later keystroke in the slug field.
     */
    if (currentName === "" || currentName === suggestDisplayName(previousSlug)) {
      form.setValue("displayName", suggestDisplayName(next));
    }
  };

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await createEventAction(values);

    if (!result.ok) {
      for (const { field, message } of domainErrorToFormErrors(result.error)) {
        form.setError(field as keyof CreateEventInput | typeof ROOT_ERROR_FIELD, { message });
      }
      return;
    }

    // Navigate on the client rather than redirecting from the action: a
    // redirect thrown mid-mutation would discard the field errors above.
    setNavigating(true);
    router.push(eventPath(result.value.id));
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
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
          value={slug}
          onChange={(event) => {
            onSlugChange(event.target.value);
          }}
          onBlur={() => {
            void form.trigger("slug");
          }}
          name="slug"
          aria-invalid={Boolean(errors.slug)}
          aria-describedby={errors.slug ? "slug-error" : "slug-preview"}
          autoFocus
        />
        <div id="slug-preview">
          <SlugUrlPreview slug={slug} />
        </div>
        {errors.slug ? (
          <FieldError id="slug-error">{errors.slug.message}</FieldError>
        ) : (
          <SlugAvailabilityHint state={availability} />
        )}
      </Field>

      <Field data-invalid={Boolean(errors.displayName) || undefined}>
        <FieldLabel htmlFor="displayName">Event name</FieldLabel>
        <Input
          id="displayName"
          aria-invalid={Boolean(errors.displayName)}
          aria-describedby={errors.displayName ? "displayName-error" : "displayName-description"}
          {...form.register("displayName")}
        />
        {errors.displayName ? (
          <FieldError id="displayName-error">{errors.displayName.message}</FieldError>
        ) : (
          <FieldDescription id="displayName-description">
            Shown in your site&rsquo;s header and page title. Add proper spacing and capitals — for
            example, <span className="text-foreground">TEDxMcGill University</span>.
          </FieldDescription>
        )}
        {displayName.length > 0 && !errors.displayName ? (
          <p
            aria-hidden
            className="truncate border-l-2 border-border pl-3 text-lg font-semibold tracking-tight"
          >
            {displayName}
          </p>
        ) : null}
      </Field>

      <Field data-invalid={Boolean(errors.tedEventUrl) || undefined}>
        <FieldLabel htmlFor="tedEventUrl">Official TED event page</FieldLabel>
        <Input
          id="tedEventUrl"
          type="url"
          placeholder="https://www.ted.com/tedx/events/12345"
          aria-invalid={Boolean(errors.tedEventUrl)}
          aria-describedby={errors.tedEventUrl ? "tedEventUrl-error" : "tedEventUrl-description"}
          {...form.register("tedEventUrl")}
        />
        {errors.tedEventUrl ? (
          <FieldError id="tedEventUrl-error">{errors.tedEventUrl.message}</FieldError>
        ) : (
          <FieldDescription id="tedEventUrl-description">
            The listing for your event on ted.com. We use it to verify your licence before your site
            goes live.
          </FieldDescription>
        )}
      </Field>

      <Field data-invalid={Boolean(errors.licenseHolderName) || undefined}>
        <FieldLabel htmlFor="licenseHolderName">Licence holder</FieldLabel>
        <Input
          id="licenseHolderName"
          autoComplete="name"
          aria-invalid={Boolean(errors.licenseHolderName)}
          aria-describedby={
            errors.licenseHolderName ? "licenseHolderName-error" : "licenseHolderName-description"
          }
          {...form.register("licenseHolderName")}
        />
        {errors.licenseHolderName ? (
          <FieldError id="licenseHolderName-error">{errors.licenseHolderName.message}</FieldError>
        ) : (
          <FieldDescription id="licenseHolderName-description">
            The person or organization named on the TEDx licence.
          </FieldDescription>
        )}
      </Field>

      <Field
        orientation="horizontal"
        data-invalid={Boolean(errors.authorizationConfirmed) || undefined}
      >
        <Checkbox
          id="authorizationConfirmed"
          checked={authorizationConfirmed}
          onCheckedChange={(checked) => {
            form.setValue("authorizationConfirmed", checked === true, {
              shouldValidate: form.formState.isSubmitted,
            });
          }}
          aria-invalid={Boolean(errors.authorizationConfirmed)}
          aria-describedby={
            errors.authorizationConfirmed ? "authorizationConfirmed-error" : undefined
          }
        />
        <div className="flex flex-col gap-1">
          <FieldLabel htmlFor="authorizationConfirmed">
            <FieldTitle>I am authorized to represent this event</FieldTitle>
          </FieldLabel>
          <FieldDescription>
            I confirm this event holds a valid TEDx licence and that I am authorized to publish a
            website for it.
          </FieldDescription>
          {errors.authorizationConfirmed ? (
            <FieldError id="authorizationConfirmed-error">
              {errors.authorizationConfirmed.message}
            </FieldError>
          ) : null}
        </div>
      </Field>

      <input type="hidden" {...form.register("templateId")} />
      {errors.templateId ? <FieldError>{errors.templateId.message}</FieldError> : null}

      <div className="flex items-center gap-3">
        <Button type="submit" size="lg" disabled={pending || availability === "taken"}>
          {pending ? "Creating…" : "Create event"}
        </Button>
        <Button
          variant="ghost"
          size="lg"
          nativeButton={false}
          render={<Link href={DASHBOARD_PATH} />}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
