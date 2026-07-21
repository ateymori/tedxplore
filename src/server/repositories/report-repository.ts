import type { ReportCategory } from "@/generated/prisma/enums";

import { prisma } from "./prisma";

/**
 * Report data access (FR-45..FR-47, Phase 9).
 */

export interface CreateReportData {
  eventId: string;
  category: ReportCategory;
  explanation: string;
  reporterEmail: string | null;
  reporterIpHash: string;
}

export async function createReport(data: CreateReportData) {
  return prisma.report.create({ data });
}

/**
 * Resolves a public slug to the event id a report should be filed against.
 *
 * Scoped to *live* sites with the same `where` clause the public route uses,
 * and for the same reason: a slug that is suspended, unpublished, or
 * never-published is not something a stranger can be looking at, so a report
 * naming one is either a stale tab or someone probing. Returning `null` for
 * all of them keeps this endpoint from becoming an oracle for which slugs
 * exist — see `report-service.ts`, which deliberately answers identically
 * either way.
 */
export async function findLiveEventIdBySlug(slug: string): Promise<string | null> {
  const event = await prisma.event.findFirst({
    where: { slug, deletedAt: null, publicationStatus: "PUBLISHED" },
    select: { id: true },
  });

  return event?.id ?? null;
}
