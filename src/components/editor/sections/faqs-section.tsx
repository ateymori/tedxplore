"use client";

import { useCallback } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  addFaqAction,
  removeFaqAction,
  reorderFaqsAction,
  saveFaqAction,
} from "@/app/(app)/dashboard/events/[eventId]/actions";
import { ListRow, ListSection } from "@/components/editor/list-section";
import { useAutosave } from "@/components/editor/use-autosave";
import { useListEditor } from "@/components/editor/use-list-editor";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MAX_FAQS } from "@/config/limits";
import type { FaqRow } from "@/content/editor-defaults";
import { CONTENT_TEXT_LIMITS, faqContentSchema } from "@/lib/validation/content";
import type { FaqContentInput } from "@/lib/validation/content";

/**
 * FAQs (task 5.5, FR-18).
 *
 * The only list where both fields are required on a row that exists: the
 * serializer drops a question with no answer (BR-13), so accepting one here
 * would mean the editor showing an entry the published site silently discards.
 * A new row is therefore seeded with placeholder text in both fields rather
 * than blanks, so it is valid the moment it appears.
 */
export function FaqsSection({
  eventId,
  initialItems,
  initialUpdatedAt,
  onConflict,
}: {
  eventId: string;
  initialItems: FaqRow[];
  initialUpdatedAt: Date;
  onConflict: () => void;
}) {
  const list = useListEditor<FaqRow>({
    initialItems,
    limit: MAX_FAQS,
    add: useCallback(
      () =>
        addFaqAction(eventId, {
          question: "New question",
          answer: "Your answer here.",
        }),
      [eventId],
    ),
    remove: useCallback((id: string) => removeFaqAction(eventId, id), [eventId]),
    reorder: useCallback((ids: string[]) => reorderFaqsAction(eventId, { ids }), [eventId]),
    createLocal: useCallback(
      (id: string): FaqRow => ({
        id,
        question: "New question",
        answer: "Your answer here.",
      }),
      [],
    ),
  });

  return (
    <ListSection
      id="faqs"
      title="FAQ"
      description="Common questions from attendees."
      count={list.items.length}
      limit={MAX_FAQS}
      error={list.error}
      adding={list.adding}
      atLimit={list.atLimit}
      addLabel="Add question"
      onAdd={list.addItem}
      emptyState="No questions yet. The FAQ section stays hidden until you add one."
    >
      {list.items.map((faq, index) => (
        <FaqRowEditor
          key={faq.id}
          eventId={eventId}
          faq={faq}
          index={index}
          total={list.items.length}
          initialUpdatedAt={initialUpdatedAt}
          onConflict={onConflict}
          onMove={(direction) => list.moveItem(faq.id, direction)}
          onMoveTo={(to) => list.moveItemTo(faq.id, to)}
          onRemove={() => list.removeItem(faq.id)}
        />
      ))}
    </ListSection>
  );
}

function FaqRowEditor({
  eventId,
  faq,
  index,
  total,
  initialUpdatedAt,
  onConflict,
  onMove,
  onMoveTo,
  onRemove,
}: {
  eventId: string;
  faq: FaqRow;
  index: number;
  total: number;
  initialUpdatedAt: Date;
  onConflict: () => void;
  onMove: (direction: -1 | 1) => void;
  onMoveTo: (toIndex: number) => void;
  onRemove: () => void;
}) {
  const form = useForm<FaqContentInput>({
    resolver: zodResolver(faqContentSchema),
    defaultValues: { question: faq.question, answer: faq.answer },
    mode: "onTouched",
  });

  const { status, saveNow } = useAutosave({
    form,
    initialUpdatedAt,
    onConflict,
    save: (values, expectedUpdatedAt) =>
      saveFaqAction(eventId, faq.id, { values, expectedUpdatedAt }),
  });

  const { errors } = form.formState;
  const question = useWatch({ control: form.control, name: "question" });
  const label = question?.trim() || `question ${index + 1}`;

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
      <Field data-invalid={Boolean(errors.question) || undefined}>
        <FieldLabel htmlFor={`faq-${faq.id}-question`}>Question</FieldLabel>
        <Input
          id={`faq-${faq.id}-question`}
          maxLength={CONTENT_TEXT_LIMITS.faqQuestion}
          aria-invalid={Boolean(errors.question)}
          {...form.register("question")}
        />
        {errors.question ? <FieldError>{errors.question.message}</FieldError> : null}
      </Field>

      <Field data-invalid={Boolean(errors.answer) || undefined}>
        <FieldLabel htmlFor={`faq-${faq.id}-answer`}>Answer</FieldLabel>
        <Textarea
          id={`faq-${faq.id}-answer`}
          rows={3}
          maxLength={CONTENT_TEXT_LIMITS.faqAnswer}
          aria-invalid={Boolean(errors.answer)}
          {...form.register("answer")}
        />
        {errors.answer ? <FieldError>{errors.answer.message}</FieldError> : null}
      </Field>
    </ListRow>
  );
}
