import type { ReportCategory, ReportStatus } from "@/generated/prisma/enums";

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

/**
 * The report inbox (FR-43, task 9.3).
 *
 * Open first and oldest-first within that, for the same reason the review
 * queue is oldest-first: a report nobody has looked at is the whole point of
 * the screen, and newest-first lets the oldest complaint starve forever.
 *
 * Includes the event so the list can name the site without an N+1, and
 * deliberately not the explanation — a list of full paragraphs is unreadable,
 * and the detail page is one click away.
 */
export async function listReports(options: { status?: ReportStatus } = {}) {
  return prisma.report.findMany({
    where: options.status === undefined ? {} : { status: options.status },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      category: true,
      status: true,
      createdAt: true,
      reporterEmail: true,
      event: { select: { id: true, slug: true, displayName: true, publicationStatus: true } },
    },
  });
}

/** The badge on the admin nav — how much unlooked-at work there is. */
export function countOpenReports(): Promise<number> {
  return prisma.report.count({ where: { status: "OPEN" } });
}

export async function findReportById(id: string) {
  return prisma.report.findUnique({
    where: { id },
    select: {
      id: true,
      category: true,
      explanation: true,
      reporterEmail: true,
      status: true,
      createdAt: true,
      resolvedAt: true,
      resolver: { select: { email: true, name: true } },
      event: {
        select: {
          id: true,
          slug: true,
          displayName: true,
          publicationStatus: true,
          deletedAt: true,
          owner: { select: { email: true, name: true } },
        },
      },
    },
  });
}

/**
 * Closes a report.
 *
 * Scoped to `status: "OPEN"` in the write itself, not just checked beforehand:
 * two admins working the inbox at once must not have the second silently
 * overwrite the first's decision and resolver. A zero-row result means someone
 * got there first, which the service reports rather than swallowing — the same
 * shape as `updateEventSlug`'s guarded write in Phase 3.
 */
export async function closeReport(
  id: string,
  status: "RESOLVED" | "DISMISSED",
  resolverId: string,
): Promise<boolean> {
  const { count } = await prisma.report.updateMany({
    where: { id, status: "OPEN" },
    data: { status, resolvedAt: new Date(), resolverId },
  });

  return count === 1;
}
