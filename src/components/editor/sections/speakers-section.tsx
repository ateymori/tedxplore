"use client";

import { useCallback, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  addSpeakerAction,
  removeSpeakerAction,
  reorderSpeakersAction,
  saveSpeakerAction,
} from "@/app/(app)/dashboard/events/[eventId]/actions";
import { ImageField } from "@/components/editor/image-field";
import { ListRow, ListSection } from "@/components/editor/list-section";
import { SocialLinksField } from "@/components/editor/social-links-field";
import { useAutosave } from "@/components/editor/use-autosave";
import { useListEditor } from "@/components/editor/use-list-editor";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MAX_SPEAKERS } from "@/config/limits";
import type { SpeakerRow } from "@/content/editor-defaults";
import { CONTENT_TEXT_LIMITS, speakerContentSchema } from "@/lib/validation/content";
import type { SpeakerContentInput } from "@/lib/validation/content";

/**
 * The speaker list (task 5.5, FR-18).
 *
 * Zero speakers is a normal state that may persist for months — a TEDx team
 * announces its lineup late — so the empty state is an invitation, not a
 * warning, and nothing here blocks a save.
 */
export function SpeakersSection({
  eventId,
  initialItems,
  initialUpdatedAt,
  onConflict,
}: {
  eventId: string;
  initialItems: SpeakerRow[];
  initialUpdatedAt: Date;
  onConflict: () => void;
}) {
  const list = useListEditor<SpeakerRow>({
    initialItems,
    limit: MAX_SPEAKERS,
    add: useCallback(() => addSpeakerAction(eventId, { name: "New speaker" }), [eventId]),
    remove: useCallback((id: string) => removeSpeakerAction(eventId, id), [eventId]),
    reorder: useCallback((ids: string[]) => reorderSpeakersAction(eventId, { ids }), [eventId]),
    createLocal: useCallback(
      (id: string): SpeakerRow => ({
        id,
        name: "New speaker",
        title: "",
        talkTitle: "",
        bio: "",
        links: [],
        photo: null,
      }),
      [],
    ),
  });

  return (
    <ListSection
      id="speakers"
      title="Speakers"
      description="Who's speaking at your event."
      count={list.items.length}
      limit={MAX_SPEAKERS}
      error={list.error}
      adding={list.adding}
      atLimit={list.atLimit}
      addLabel="Add speaker"
      onAdd={list.addItem}
      emptyState="No speakers yet. Add them as your lineup is confirmed — until then, the Speakers section simply won't appear on your site."
    >
      {list.items.map((speaker, index) => (
        <SpeakerRowEditor
          key={speaker.id}
          eventId={eventId}
          speaker={speaker}
          index={index}
          total={list.items.length}
          initialUpdatedAt={initialUpdatedAt}
          onConflict={onConflict}
          onMove={(direction) => list.moveItem(speaker.id, direction)}
          onMoveTo={(to) => list.moveItemTo(speaker.id, to)}
          onRemove={() => list.removeItem(speaker.id)}
        />
      ))}
    </ListSection>
  );
}

function SpeakerRowEditor({
  eventId,
  speaker,
  index,
  total,
  initialUpdatedAt,
  onConflict,
  onMove,
  onMoveTo,
  onRemove,
}: {
  eventId: string;
  speaker: SpeakerRow;
  index: number;
  total: number;
  initialUpdatedAt: Date;
  onConflict: () => void;
  onMove: (direction: -1 | 1) => void;
  onMoveTo: (toIndex: number) => void;
  onRemove: () => void;
}) {
  const [photo, setPhoto] = useState(speaker.photo);

  const form = useForm<SpeakerContentInput>({
    resolver: zodResolver(speakerContentSchema),
    defaultValues: {
      name: speaker.name,
      title: speaker.title,
      talkTitle: speaker.talkTitle,
      bio: speaker.bio,
      links: speaker.links,
    },
    mode: "onTouched",
  });

  const { status, saveNow } = useAutosave({
    form,
    initialUpdatedAt,
    onConflict,
    save: (values, expectedUpdatedAt) =>
      saveSpeakerAction(eventId, speaker.id, { values, expectedUpdatedAt }),
  });

  const { errors } = form.formState;
  // The row's own heading in reorder and delete labels, so a screen-reader user
  // hears "Move Ada Lovelace up" rather than "Move item 3 up".
  // `useWatch`, never `form.watch()` — the latter returns a function the React
  // Compiler cannot memoize, and it bails out of optimizing the whole row.
  const name = useWatch({ control: form.control, name: "name" });
  const label = name?.trim() || `speaker ${index + 1}`;

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
          <FieldLabel htmlFor={`speaker-${speaker.id}-name`}>Name</FieldLabel>
          <Input
            id={`speaker-${speaker.id}-name`}
            maxLength={CONTENT_TEXT_LIMITS.personName}
            aria-invalid={Boolean(errors.name)}
            {...form.register("name")}
          />
          {errors.name ? <FieldError>{errors.name.message}</FieldError> : null}
        </Field>

        <Field data-invalid={Boolean(errors.title) || undefined}>
          <FieldLabel htmlFor={`speaker-${speaker.id}-title`}>Title or role</FieldLabel>
          <Input
            id={`speaker-${speaker.id}-title`}
            maxLength={CONTENT_TEXT_LIMITS.personTitle}
            placeholder="Neuroscientist, McGill University"
            {...form.register("title")}
          />
          {errors.title ? <FieldError>{errors.title.message}</FieldError> : null}
        </Field>
      </div>

      <Field data-invalid={Boolean(errors.talkTitle) || undefined}>
        <FieldLabel htmlFor={`speaker-${speaker.id}-talk`}>Talk title</FieldLabel>
        <Input
          id={`speaker-${speaker.id}-talk`}
          maxLength={CONTENT_TEXT_LIMITS.talkTitle}
          {...form.register("talkTitle")}
        />
        {errors.talkTitle ? <FieldError>{errors.talkTitle.message}</FieldError> : null}
      </Field>

      <Field data-invalid={Boolean(errors.bio) || undefined}>
        <FieldLabel htmlFor={`speaker-${speaker.id}-bio`}>Bio</FieldLabel>
        <Textarea
          id={`speaker-${speaker.id}-bio`}
          rows={4}
          maxLength={CONTENT_TEXT_LIMITS.personBio}
          {...form.register("bio")}
        />
        {errors.bio ? <FieldError>{errors.bio.message}</FieldError> : null}
      </Field>

      <SocialLinksField
        control={form.control}
        register={form.register}
        name="links"
        idPrefix={`speaker-${speaker.id}-links`}
        errorMessage={errors.links?.message ?? errors.links?.root?.message}
      />

      <ImageField
        eventId={eventId}
        slot={{ kind: "SPEAKER_PHOTO", rowId: speaker.id }}
        value={photo}
        onChange={setPhoto}
      />
    </ListRow>
  );
}
