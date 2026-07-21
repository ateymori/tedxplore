"use client";

import { useCallback, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  addTeamMemberAction,
  removeTeamMemberAction,
  reorderTeamMembersAction,
  saveTeamMemberAction,
} from "@/app/(app)/dashboard/events/[eventId]/actions";
import { ImageField } from "@/components/editor/image-field";
import { ListRow, ListSection } from "@/components/editor/list-section";
import { SocialLinksField } from "@/components/editor/social-links-field";
import { useAutosave } from "@/components/editor/use-autosave";
import { useListEditor } from "@/components/editor/use-list-editor";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MAX_TEAM_MEMBERS } from "@/config/limits";
import type { TeamMemberRow } from "@/content/editor-defaults";
import { CONTENT_TEXT_LIMITS, teamMemberContentSchema } from "@/lib/validation/content";
import type { TeamMemberContentInput } from "@/lib/validation/content";

/** The organizing team (task 5.5, FR-18). */
export function TeamSection({
  eventId,
  initialItems,
  initialUpdatedAt,
  onConflict,
}: {
  eventId: string;
  initialItems: TeamMemberRow[];
  initialUpdatedAt: Date;
  onConflict: () => void;
}) {
  const list = useListEditor<TeamMemberRow>({
    initialItems,
    limit: MAX_TEAM_MEMBERS,
    add: useCallback(() => addTeamMemberAction(eventId, { name: "New team member" }), [eventId]),
    remove: useCallback((id: string) => removeTeamMemberAction(eventId, id), [eventId]),
    reorder: useCallback((ids: string[]) => reorderTeamMembersAction(eventId, { ids }), [eventId]),
    createLocal: useCallback(
      (id: string): TeamMemberRow => ({
        id,
        name: "New team member",
        role: "",
        links: [],
        photo: null,
      }),
      [],
    ),
  });

  return (
    <ListSection
      id="team"
      title="Team"
      description="The people organizing your event."
      count={list.items.length}
      limit={MAX_TEAM_MEMBERS}
      error={list.error}
      adding={list.adding}
      atLimit={list.atLimit}
      addLabel="Add team member"
      onAdd={list.addItem}
      emptyState="No team members yet. This section stays hidden on your site until you add someone."
    >
      {list.items.map((member, index) => (
        <TeamMemberRowEditor
          key={member.id}
          eventId={eventId}
          member={member}
          index={index}
          total={list.items.length}
          initialUpdatedAt={initialUpdatedAt}
          onConflict={onConflict}
          onMove={(direction) => list.moveItem(member.id, direction)}
          onMoveTo={(to) => list.moveItemTo(member.id, to)}
          onRemove={() => list.removeItem(member.id)}
        />
      ))}
    </ListSection>
  );
}

function TeamMemberRowEditor({
  eventId,
  member,
  index,
  total,
  initialUpdatedAt,
  onConflict,
  onMove,
  onMoveTo,
  onRemove,
}: {
  eventId: string;
  member: TeamMemberRow;
  index: number;
  total: number;
  initialUpdatedAt: Date;
  onConflict: () => void;
  onMove: (direction: -1 | 1) => void;
  onMoveTo: (toIndex: number) => void;
  onRemove: () => void;
}) {
  const [photo, setPhoto] = useState(member.photo);

  const form = useForm<TeamMemberContentInput>({
    resolver: zodResolver(teamMemberContentSchema),
    defaultValues: { name: member.name, role: member.role, links: member.links },
    mode: "onTouched",
  });

  const { status, saveNow } = useAutosave({
    form,
    initialUpdatedAt,
    onConflict,
    save: (values, expectedUpdatedAt) =>
      saveTeamMemberAction(eventId, member.id, { values, expectedUpdatedAt }),
  });

  const { errors } = form.formState;
  const name = useWatch({ control: form.control, name: "name" });
  const label = name?.trim() || `team member ${index + 1}`;

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
          <FieldLabel htmlFor={`team-${member.id}-name`}>Name</FieldLabel>
          <Input
            id={`team-${member.id}-name`}
            maxLength={CONTENT_TEXT_LIMITS.personName}
            aria-invalid={Boolean(errors.name)}
            {...form.register("name")}
          />
          {errors.name ? <FieldError>{errors.name.message}</FieldError> : null}
        </Field>

        <Field data-invalid={Boolean(errors.role) || undefined}>
          <FieldLabel htmlFor={`team-${member.id}-role`}>Role</FieldLabel>
          <Input
            id={`team-${member.id}-role`}
            maxLength={CONTENT_TEXT_LIMITS.personTitle}
            placeholder="Curator"
            {...form.register("role")}
          />
          {errors.role ? <FieldError>{errors.role.message}</FieldError> : null}
        </Field>
      </div>

      <SocialLinksField
        control={form.control}
        register={form.register}
        name="links"
        idPrefix={`team-${member.id}-links`}
        errorMessage={errors.links?.message ?? errors.links?.root?.message}
      />

      <ImageField
        eventId={eventId}
        slot={{ kind: "TEAM_PHOTO", rowId: member.id }}
        value={photo}
        onChange={setPhoto}
      />
    </ListRow>
  );
}
