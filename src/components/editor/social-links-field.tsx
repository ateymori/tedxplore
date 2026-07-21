"use client";

import {
  useFieldArray,
  type Control,
  type FieldValues,
  type Path,
  type UseFormRegister,
} from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { MAX_SOCIAL_LINKS } from "@/lib/validation/content";

/**
 * The repeating platform + URL editor, shared by the contact section and every
 * person in the speaker and team lists.
 *
 * Written once and made generic over the form because the three uses are the
 * same control over the same `SocialLink[]` shape — and because BR-12's URL
 * rule and the platform enum are things that must not be allowed to differ
 * between "the event's Instagram" and "a speaker's Instagram".
 *
 * A row whose URL is left blank is dropped server-side rather than rejected
 * (see `socialLinksSchema`), so clicking "Add link" and changing your mind
 * costs nothing — which is why there is no confirmation on the remove button
 * either.
 */

const PLATFORM_LABELS = [
  ["WEBSITE", "Website"],
  ["INSTAGRAM", "Instagram"],
  ["X", "X (Twitter)"],
  ["FACEBOOK", "Facebook"],
  ["LINKEDIN", "LinkedIn"],
  ["YOUTUBE", "YouTube"],
  ["TIKTOK", "TikTok"],
  ["OTHER", "Other"],
] as const;

export function SocialLinksField<T extends FieldValues>({
  control,
  register,
  name,
  idPrefix,
  label = "Links",
  description,
  errorMessage,
}: {
  control: Control<T>;
  /** Taken as a prop rather than reached for via `control.register`, which is
   * internal API and has changed shape between React Hook Form releases. */
  register: UseFormRegister<T>;
  /** The array field's path, e.g. `"socialLinks"` or `"links"`. */
  name: Path<T>;
  /** Namespaces the generated input ids; must be unique per rendered instance. */
  idPrefix: string;
  label?: string;
  description?: string;
  /**
   * The array-level message (too many links, or a row that failed BR-12).
   * Per-row messages are not surfaced individually: the row is right there,
   * and one message above the group reads better than five identical ones.
   */
  errorMessage?: string;
}) {
  const { fields, append, remove } = useFieldArray({ control, name: name as never });
  const atLimit = fields.length >= MAX_SOCIAL_LINKS;

  return (
    <Field data-invalid={Boolean(errorMessage) || undefined}>
      <FieldLabel>{label}</FieldLabel>

      {fields.length === 0 ? null : (
        <ul className="flex flex-col gap-2">
          {fields.map((field, index) => (
            <li key={field.id} className="flex items-start gap-2">
              <div className="w-40 shrink-0">
                <label className="sr-only" htmlFor={`${idPrefix}-platform-${index}`}>
                  Platform for link {index + 1}
                </label>
                <NativeSelect
                  id={`${idPrefix}-platform-${index}`}
                  {...register(`${name}.${index}.platform` as Path<T>)}
                >
                  {PLATFORM_LABELS.map(([value, text]) => (
                    <option key={value} value={value}>
                      {text}
                    </option>
                  ))}
                </NativeSelect>
              </div>

              <div className="flex-1">
                <label className="sr-only" htmlFor={`${idPrefix}-url-${index}`}>
                  URL for link {index + 1}
                </label>
                <Input
                  id={`${idPrefix}-url-${index}`}
                  type="url"
                  inputMode="url"
                  placeholder="https://…"
                  {...register(`${name}.${index}.url` as Path<T>)}
                />
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => remove(index)}
                aria-label={`Remove link ${index + 1}`}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={atLimit}
          onClick={() => append({ platform: "WEBSITE", url: "" } as never)}
        >
          <Plus />
          Add link
        </Button>
        {atLimit ? (
          <span className="text-xs text-muted-foreground">
            That&rsquo;s the maximum of {MAX_SOCIAL_LINKS}.
          </span>
        ) : null}
      </div>

      {errorMessage === undefined ? (
        description === undefined ? null : (
          <FieldDescription>{description}</FieldDescription>
        )
      ) : (
        <FieldError>{errorMessage}</FieldError>
      )}
    </Field>
  );
}
