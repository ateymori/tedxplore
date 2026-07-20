import type { PublicationStatus } from "@/generated/prisma/enums";

/**
 * Event lifecycle rules.
 *
 * Pure functions over a publication status — no database, no session, no
 * Prisma. Kept separate from `event-service.ts` so the rules that actually
 * decide what happens to a user's site can be unit-tested exhaustively, rather
 * than being reachable only through a service call that needs a live database.
 */

/**
 * BR-5: the slug is editable only before the first publication, and locked
 * permanently afterwards — including after an unpublish or a suspension.
 *
 * The rule is "has this URL ever been public", not "is it public now": an
 * unpublished site's links, bookmarks, and search results still point at the
 * old slug, and letting someone else claim it later is how a URL silently
 * changes what it refers to.
 */
export function isSlugEditable(status: PublicationStatus): boolean {
  return status === "NEVER_PUBLISHED";
}

export type DeletionMode = "HARD" | "SOFT";

/**
 * FR-13 / flow 4.3: how deleting this event should behave.
 *
 * A draft nobody has ever seen leaves nothing worth auditing, so it is removed
 * outright and its slug returns to the pool. Anything that has ever been
 * public is soft-deleted instead: admins may need to answer for what was
 * published (A-2), and — just as importantly — the slug stays reserved so the
 * URL can never be inherited by a different event.
 *
 * Same reasoning as `isSlugEditable`, and deliberately the same condition: if
 * one of these ever needs to diverge from the other, that is a business-rule
 * change worth making explicit rather than a detail to be discovered.
 */
export function deletionMode(status: PublicationStatus): DeletionMode {
  return status === "NEVER_PUBLISHED" ? "HARD" : "SOFT";
}

/** Whether deleting releases the slug for reuse — true only for hard deletes. */
export function deletionReleasesSlug(status: PublicationStatus): boolean {
  return deletionMode(status) === "HARD";
}
