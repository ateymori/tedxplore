"use client";

import { useCallback, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  addSponsorAction,
  removeSponsorAction,
  reorderSponsorsAction,
  saveSponsorAction,
} from "@/app/(app)/dashboard/events/[eventId]/actions";
import { ImageField } from "@/components/editor/image-field";
import { ListRow, ListSection } from "@/components/editor/list-section";
import { useAutosave } from "@/components/editor/use-autosave";
import { useListEditor } from "@/components/editor/use-list-editor";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { MAX_SPONSORS } from "@/config/limits";
import type { SponsorRow } from "@/content/editor-defaults";
import { CONTENT_TEXT_LIMITS, sponsorContentSchema } from "@/lib/validation/content";
import type { SponsorContentInput } from "@/lib/validation/content";

/**
 * Sponsors (task 5.5, FR-18).
 *
 * Tier is a fixed set, and the template groups by it — each tier auto-hides
 * independently when it has no sponsors (FR-38), so an organizer with only
 * community supporters gets a Community block and nothing else, rather than
 * four empty headings.
 *
 * The order set here is the order *within* a tier; the tiers themselves are
 * always ranked by the template. That is worth saying in the UI, because a
 * dragged row that appears to jump is otherwise baffling.
 */

const TIERS = [
  ["PARTNER", "Partner"],
  ["PLATINUM", "Platinum"],
  ["GOLD", "Gold"],
  ["SILVER", "Silver"],
  ["BRONZE", "Bronze"],
  ["COMMUNITY", "Community"],
] as const;

export function SponsorsSection({
  eventId,
  initialItems,
  initialUpdatedAt,
  onConflict,
}: {
  eventId: string;
  initialItems: SponsorRow[];
  initialUpdatedAt: Date;
  onConflict: () => void;
}) {
  const list = useListEditor<SponsorRow>({
    initialItems,
    limit: MAX_SPONSORS,
    add: useCallback(
      () => addSponsorAction(eventId, { name: "New sponsor", tier: "GOLD" }),
      [eventId],
    ),
    remove: useCallback((id: string) => removeSponsorAction(eventId, id), [eventId]),
    reorder: useCallback((ids: string[]) => reorderSponsorsAction(eventId, { ids }), [eventId]),
    createLocal: useCallback(
      (id: string): SponsorRow => ({
        id,
        name: "New sponsor",
        tier: "GOLD",
        websiteUrl: "",
        logo: null,
      }),
      [],
    ),
  });

  return (
    <ListSection
      id="sponsors"
      title="Sponsors"
      description="Grouped by tier on your site. The order here sets the order within each tier."
      count={list.items.length}
      limit={MAX_SPONSORS}
      error={list.error}
      adding={list.adding}
      atLimit={list.atLimit}
      addLabel="Add sponsor"
      onAdd={list.addItem}
      emptyState="No sponsors yet. Each tier appears on your site only once it has someone in it."
    >
      {list.items.map((sponsor, index) => (
        <SponsorRowEditor
          key={sponsor.id}
          eventId={eventId}
          sponsor={sponsor}
          index={index}
          total={list.items.length}
          initialUpdatedAt={initialUpdatedAt}
          onConflict={onConflict}
          onMove={(direction) => list.moveItem(sponsor.id, direction)}
          onMoveTo={(to) => list.moveItemTo(sponsor.id, to)}
          onRemove={() => list.removeItem(sponsor.id)}
        />
      ))}
    </ListSection>
  );
}

function SponsorRowEditor({
  eventId,
  sponsor,
  index,
  total,
  initialUpdatedAt,
  onConflict,
  onMove,
  onMoveTo,
  onRemove,
}: {
  eventId: string;
  sponsor: SponsorRow;
  index: number;
  total: number;
  initialUpdatedAt: Date;
  onConflict: () => void;
  onMove: (direction: -1 | 1) => void;
  onMoveTo: (toIndex: number) => void;
  onRemove: () => void;
}) {
  const [logo, setLogo] = useState(sponsor.logo);

  const form = useForm<SponsorContentInput>({
    resolver: zodResolver(sponsorContentSchema),
    defaultValues: {
      name: sponsor.name,
      tier: sponsor.tier,
      websiteUrl: sponsor.websiteUrl,
    },
    mode: "onTouched",
  });

  const { status, saveNow } = useAutosave({
    form,
    initialUpdatedAt,
    onConflict,
    save: (values, expectedUpdatedAt) =>
      saveSponsorAction(eventId, sponsor.id, { values, expectedUpdatedAt }),
  });

  const { errors } = form.formState;
  const name = useWatch({ control: form.control, name: "name" });
  const label = name?.trim() || `sponsor ${index + 1}`;

  return (
    <ListRow
      index={index}
      total={total}
      title={label}
      status={status}
      onSaveNow={saveNow}
      onMove={onMove}
      onMoveTo={onMoveTo}
      onRemove={onRemove}
      removeLabel={`Remove ${label}`}
      error={errors.root?.message}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field data-invalid={Boolean(errors.name) || undefined}>
          <FieldLabel htmlFor={`sponsor-${sponsor.id}-name`}>Sponsor name</FieldLabel>
          <Input
            id={`sponsor-${sponsor.id}-name`}
            maxLength={CONTENT_TEXT_LIMITS.sponsorName}
            aria-invalid={Boolean(errors.name)}
            {...form.register("name")}
          />
          {errors.name ? <FieldError>{errors.name.message}</FieldError> : null}
        </Field>

        <Field data-invalid={Boolean(errors.tier) || undefined}>
          <FieldLabel htmlFor={`sponsor-${sponsor.id}-tier`}>Tier</FieldLabel>
          <NativeSelect id={`sponsor-${sponsor.id}-tier`} {...form.register("tier")}>
            {TIERS.map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </NativeSelect>
          {errors.tier ? <FieldError>{errors.tier.message}</FieldError> : null}
        </Field>
      </div>

      <Field data-invalid={Boolean(errors.websiteUrl) || undefined}>
        <FieldLabel htmlFor={`sponsor-${sponsor.id}-url`}>Website</FieldLabel>
        <Input
          id={`sponsor-${sponsor.id}-url`}
          type="url"
          inputMode="url"
          placeholder="https://…"
          {...form.register("websiteUrl")}
        />
        {errors.websiteUrl ? (
          <FieldError>{errors.websiteUrl.message}</FieldError>
        ) : (
          <FieldDescription>Optional. The logo links here, opening in a new tab.</FieldDescription>
        )}
      </Field>

      <ImageField
        eventId={eventId}
        slot={{ kind: "SPONSOR_LOGO", rowId: sponsor.id }}
        value={logo}
        onChange={setLogo}
      />
    </ListRow>
  );
}
