import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { isCloudinaryConfigured } from "@/config/env";
import { MAX_IMAGE_BYTES } from "@/config/limits";
import { ACCEPTED_FORMATS_LABEL, eventMediaFolder, isAcceptedImageFormat } from "@/config/media";
import type { SessionUser } from "@/server/auth";
import * as cloudinary from "@/server/adapters/cloudinary";
import * as media from "@/server/repositories/media-repository";
import { loadManageable } from "@/server/services/event-service";
import { err, ok, type Result } from "@/server/services/result";
import { parseInput } from "@/server/services/validation";
import type { ContentSaveResult } from "@/server/services/content-service";

/**
 * Image upload services (task 5.4).
 *
 * The flow is three steps, and which step does what is the whole design:
 *
 *   1. `createImageUploadTicket` — authorize, then hand back a signature that
 *      only permits an upload into this event's folder, under a name we chose.
 *   2. The browser posts the file straight to Cloudinary. Nothing of ours is
 *      involved; a 10 MB body never touches a serverless function.
 *   3. `attachImage` — authorize again, then **re-read the asset from
 *      Cloudinary** and write our own record from that. The client's report of
 *      what it uploaded is treated as a hint about *which* asset to look up,
 *      and as nothing else.
 *
 * Step 3 is the part that matters. Trusting the client's reported dimensions
 * would let it lie about the numbers templates use to reserve layout space;
 * trusting its reported public id would let it attach an asset belonging to
 * another event. Both are closed by looking the asset up ourselves and
 * checking the id is inside this event's folder.
 */

/** What a slot needs to identify itself. Rows carry an id; the two singletons don't. */
export const imageSlotSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("HERO") }),
  z.object({ kind: z.literal("VENUE") }),
  z.object({ kind: z.literal("SPEAKER_PHOTO"), rowId: z.string().min(1) }),
  z.object({ kind: z.literal("TEAM_PHOTO"), rowId: z.string().min(1) }),
  z.object({ kind: z.literal("SPONSOR_LOGO"), rowId: z.string().min(1) }),
]);

export type ImageSlot = z.infer<typeof imageSlotSchema>;

export interface UploadTicket {
  url: string;
  fields: Record<string, string>;
  publicId: string;
  /** Echoed back so the client can show the same limits the server enforces. */
  maxBytes: number;
}

/**
 * Step 1: a signed, scoped permission to upload exactly one image.
 *
 * The public id is a UUID rather than anything derived from the file name or
 * the slot: file names are user input that would end up in a public URL, and a
 * slot-derived name would collide when an organizer replaces an image, forcing
 * either an overwrite (which would mutate an asset a published snapshot still
 * points at) or a guessing game about suffixes.
 */
export async function createImageUploadTicket(
  user: SessionUser,
  eventId: string,
  input: unknown,
): Promise<Result<UploadTicket>> {
  const loaded = await loadManageable(user, eventId);
  if (!loaded.ok) return loaded;

  const parsed = parseInput(imageSlotSchema, input);
  if (!parsed.ok) return parsed;

  if (!isCloudinaryConfigured) {
    return err({
      type: "VALIDATION_FAILED",
      issues: {
        _form: ["Image uploads aren't available right now. Please try again later."],
      },
    });
  }

  const ticket = cloudinary.createUploadTicket({
    folder: eventMediaFolder(eventId),
    publicId: `${parsed.value.kind.toLowerCase()}-${randomUUID()}`,
  });

  return ok({
    url: ticket.url,
    fields: ticket.fields,
    publicId: ticket.publicId,
    maxBytes: MAX_IMAGE_BYTES,
  });
}

export const attachImageSchema = z.object({
  slot: imageSlotSchema,
  publicId: z.string().min(1),
});

/**
 * Step 3: verify the upload really happened, record it, and point the slot at it.
 *
 * Order matters. The folder check comes before the Cloudinary lookup so a
 * client probing for other events' assets is refused without us making a
 * network call on its behalf; the format and size checks come after, because
 * only Cloudinary can answer them truthfully.
 */
export async function attachImage(
  user: SessionUser,
  eventId: string,
  input: unknown,
): Promise<Result<ContentSaveResult & { publicId: string; width: number; height: number }>> {
  const loaded = await loadManageable(user, eventId);
  if (!loaded.ok) return loaded;

  const parsed = parseInput(attachImageSchema, input);
  if (!parsed.ok) return parsed;

  const { slot, publicId } = parsed.value;

  // The signature already prevents uploading outside this folder; this stops a
  // client *claiming* an asset from outside it that was uploaded legitimately
  // elsewhere. Both checks are needed — they close different holes.
  if (!publicId.startsWith(`${eventMediaFolder(eventId)}/`)) {
    return err({ type: "NOT_FOUND", resource: "image" });
  }

  const resource = await cloudinary.fetchResource(publicId);
  if (resource === null) {
    return err({ type: "NOT_FOUND", resource: "image" });
  }

  if (!isAcceptedImageFormat(resource.format)) {
    return err({
      type: "VALIDATION_FAILED",
      issues: { _form: [`That file type isn't supported. Use ${ACCEPTED_FORMATS_LABEL}.`] },
    });
  }

  // FR-21's ceiling, enforced against Cloudinary's byte count rather than the
  // browser's — the client-side check is a courtesy, this is the rule.
  if (resource.bytes > MAX_IMAGE_BYTES) {
    return err({
      type: "VALIDATION_FAILED",
      issues: {
        _form: [`That image is too large. The limit is ${MAX_IMAGE_BYTES / (1024 * 1024)} MB.`],
      },
    });
  }

  const asset = await media.recordMediaAsset({
    eventId,
    uploaderId: user.id,
    cloudinaryPublicId: resource.publicId,
    kind: slot.kind,
    format: resource.format,
    width: resource.width,
    height: resource.height,
    bytes: resource.bytes,
  });

  const updatedAt = await media.attachImage(eventId, slot, asset.id);
  // The row vanished between the checks and the write — deleted in another tab.
  if (updatedAt === null) return err({ type: "NOT_FOUND", resource: "item" });

  return ok({
    updatedAt,
    conflicted: false,
    publicId: resource.publicId,
    width: resource.width,
    height: resource.height,
  });
}

export const removeImageSchema = z.object({ slot: imageSlotSchema });

/**
 * Clears a slot.
 *
 * The `MediaAsset` row and the Cloudinary asset both stay. A published
 * snapshot is immutable (invariant 3) and may still be rendering this image, so
 * deleting the file here would break a live site to tidy up a draft. The orphan
 * sweep in task 10.4 is what eventually reclaims assets no snapshot references.
 */
export async function removeImage(
  user: SessionUser,
  eventId: string,
  input: unknown,
): Promise<Result<ContentSaveResult>> {
  const loaded = await loadManageable(user, eventId);
  if (!loaded.ok) return loaded;

  const parsed = parseInput(removeImageSchema, input);
  if (!parsed.ok) return parsed;

  const updatedAt = await media.attachImage(eventId, parsed.value.slot, null);
  if (updatedAt === null) return err({ type: "NOT_FOUND", resource: "item" });

  return ok({ updatedAt, conflicted: false });
}
