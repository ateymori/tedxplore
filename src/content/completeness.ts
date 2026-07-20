import type { EventContent } from "./event-content";

/**
 * Submission completeness gate (BR-14 / FR-30).
 *
 * Deliberately separate from — and much stricter than — field-level
 * validation. Saving a draft requires only a display name (FR-15a); *asking
 * the world to look at it* requires enough substance to be a real event page.
 * Keeping the two checks in different modules is what stops the stricter rule
 * from leaking into the editor and blocking early-stage drafts.
 *
 * This runs against `EventContent`, not draft rows, so it judges exactly what
 * would be published — after blank-collapsing and unusable-row removal.
 */

/** Stable identifiers so the UI can link each problem to its editor section. */
export type CompletenessField =
  | "displayName"
  | "themeOrAbout"
  | "eventDate"
  | "venueName"
  | "contactEmail";

export interface CompletenessIssue {
  field: CompletenessField;
  /** Which editor section the organizer needs to open to fix it. */
  section: "basics" | "about" | "schedule" | "venue" | "contact";
  message: string;
}

export type CompletenessResult =
  | { ok: true }
  | { ok: false; issues: CompletenessIssue[] };

export function checkCompleteness(content: EventContent): CompletenessResult {
  const issues: CompletenessIssue[] = [];

  // Belt-and-braces: the schema already guarantees this, but the submission
  // path should not depend on that to state the requirement.
  if (content.displayName.trim().length === 0) {
    issues.push({
      field: "displayName",
      section: "basics",
      message: "Add your event's display name.",
    });
  }

  // BR-14 accepts either — the requirement is that a visitor learns what the
  // event is about, and either field can carry that.
  if (content.theme === null && content.about === null) {
    issues.push({
      field: "themeOrAbout",
      section: "about",
      message: "Add a theme or an about description so visitors know what your event is about.",
    });
  }

  if (content.schedule.startsAt === null) {
    issues.push({
      field: "eventDate",
      section: "schedule",
      message: "Set your event date and time.",
    });
  }

  if (content.venue.name === null) {
    issues.push({
      field: "venueName",
      section: "venue",
      message: "Add the venue name.",
    });
  }

  if (content.contact.email === null) {
    issues.push({
      field: "contactEmail",
      section: "contact",
      message: "Add a contact email so attendees can reach you.",
    });
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
