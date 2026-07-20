"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2 } from "lucide-react";

import { updateEventSettingsAction } from "@/app/(app)/dashboard/events/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { domainErrorToFormErrors, ROOT_ERROR_FIELD } from "@/lib/form-errors";
import { eventSettingsSchema, type EventSettingsInput } from "@/lib/validation/event";

/**
 * Display name and licensing info (task 3.3).
 *
 * All three fields stay editable for the life of the event: the display name
 * carries no uniqueness or URL implications (BR-5c), and the licensing details
 * are an attestation an organizer may legitimately need to correct. The slug
 * is not here — it has its own rules and its own form.
 */
export function EventSettingsForm({
  eventId,
  defaultValues,
}: {
  eventId: string;
  defaultValues: EventSettingsInput;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);

  const form = useForm<EventSettingsInput>({
    resolver: zodResolver(eventSettingsSchema),
    defaultValues,
  });

  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setSaved(false);
    const result = await updateEventSettingsAction(eventId, values);

    if (!result.ok) {
      for (const { field, message } of domainErrorToFormErrors(result.error)) {
        form.setError(field as keyof EventSettingsInput | typeof ROOT_ERROR_FIELD, { message });
      }
      return;
    }

    // Re-baseline the form so the fields are no longer "dirty" and a second
    // submit without changes is a no-op rather than a redundant write.
    form.reset(values);
    setSaved(true);
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {errors.root ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{errors.root.message}</AlertDescription>
        </Alert>
      ) : null}

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
            Shown in your site&rsquo;s header and page title. You can change this at any time, even
            after publishing.
          </FieldDescription>
        )}
      </Field>

      <Field data-invalid={Boolean(errors.tedEventUrl) || undefined}>
        <FieldLabel htmlFor="tedEventUrl">Official TED event page</FieldLabel>
        <Input
          id="tedEventUrl"
          type="url"
          aria-invalid={Boolean(errors.tedEventUrl)}
          aria-describedby={errors.tedEventUrl ? "tedEventUrl-error" : undefined}
          {...form.register("tedEventUrl")}
        />
        {errors.tedEventUrl ? (
          <FieldError id="tedEventUrl-error">{errors.tedEventUrl.message}</FieldError>
        ) : null}
      </Field>

      <Field data-invalid={Boolean(errors.licenseHolderName) || undefined}>
        <FieldLabel htmlFor="licenseHolderName">Licence holder</FieldLabel>
        <Input
          id="licenseHolderName"
          autoComplete="name"
          aria-invalid={Boolean(errors.licenseHolderName)}
          aria-describedby={errors.licenseHolderName ? "licenseHolderName-error" : undefined}
          {...form.register("licenseHolderName")}
        />
        {errors.licenseHolderName ? (
          <FieldError id="licenseHolderName-error">{errors.licenseHolderName.message}</FieldError>
        ) : null}
      </Field>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save changes"}
        </Button>
        <span aria-live="polite" className="text-sm text-muted-foreground">
          {saved && !form.formState.isDirty ? (
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
