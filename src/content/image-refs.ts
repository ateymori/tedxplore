import type { EventContent } from "./event-content";

/**
 * Every Cloudinary public id an `EventContent` document references.
 *
 * Used by the orphaned-media sweep (task 10.4) to protect assets a *snapshot*
 * still points at. Snapshots are immutable and retained for audit and
 * restoration (invariant 3), and they embed image public ids in their frozen
 * JSON rather than holding a foreign key — so an asset can have every draft FK
 * cleared (a replaced hero, a removed speaker photo) while a live or restorable
 * published site is still rendering it. Deleting that asset from Cloudinary
 * would break the published page. This is the function that says "hands off".
 *
 * Pure and total over the image slots, so it is unit-tested against the schema
 * directly rather than through the database.
 */
export function collectImagePublicIds(content: EventContent): Set<string> {
  const ids = new Set<string>();

  const add = (ref: { cloudinaryPublicId: string } | null): void => {
    if (ref !== null) ids.add(ref.cloudinaryPublicId);
  };

  add(content.heroImage);
  add(content.venue.image);
  for (const speaker of content.speakers) add(speaker.photo);
  for (const member of content.team) add(member.photo);
  for (const sponsor of content.sponsors) add(sponsor.logo);

  return ids;
}
