"use server";

import { revalidatePath } from "next/cache";

import {
  ADMIN_PATH,
  ADMIN_REPORTS_PATH,
  adminEventPath,
  adminReportPath,
  reviewRequestPath,
} from "@/config/routes";
import { getAdminUser } from "@/server/auth-guards";
import { revalidateSite } from "@/server/revalidate";
import * as reportAdminService from "@/server/services/report-admin-service";
import * as reviewService from "@/server/services/review-service";
import type { Result } from "@/server/services/result";

/**
 * Server Actions for the admin area (tasks 7.3, 7.5).
 *
 * Transport only, exactly like the dashboard's: authenticate, delegate, return.
 * `getAdminUser` returns a `Result` rather than redirecting — an action that
 * redirects mid-mutation throws away the error the form needs to render — and
 * the service re-checks the role anyway, so the gate does not depend on this
 * file being the only door.
 *
 * All four revalidate the public site as well as the admin pages: each one
 * changes what a visitor sees. `revalidateSite` uses `updateTag`, which is
 * Server-Action-only, so this is the layer it has to happen in
 * (`server/revalidate.ts`).
 */

function revalidateAdminViews(eventId: string, requestId?: string) {
  revalidatePath(ADMIN_PATH);
  revalidatePath(adminEventPath(eventId));
  if (requestId !== undefined) revalidatePath(reviewRequestPath(requestId));
}

export async function approveRequestAction(
  requestId: string,
): Promise<Result<reviewService.DecisionResult>> {
  const auth = await getAdminUser();
  if (!auth.ok) return auth;

  const result = await reviewService.approveRequest(auth.value, requestId);
  if (result.ok) {
    revalidateSite(result.value.slug);
    revalidateAdminViews(result.value.eventId, requestId);
  }

  return result;
}

export async function rejectRequestAction(
  requestId: string,
  input: unknown,
): Promise<Result<reviewService.DecisionResult>> {
  const auth = await getAdminUser();
  if (!auth.ok) return auth;

  const result = await reviewService.rejectRequest(auth.value, requestId, input);
  if (result.ok) {
    // No `revalidateSite`: a rejection leaves the live snapshot untouched
    // (BR-8a), so nothing a visitor can see has changed.
    revalidateAdminViews(result.value.eventId, requestId);
  }

  return result;
}

export async function suspendEventAction(
  eventId: string,
  input: unknown,
): Promise<Result<reviewService.DecisionResult>> {
  const auth = await getAdminUser();
  if (!auth.ok) return auth;

  const result = await reviewService.suspendEvent(auth.value, eventId, input);
  if (result.ok) {
    revalidateSite(result.value.slug);
    revalidateAdminViews(result.value.eventId);
  }

  return result;
}

export async function restoreEventAction(
  eventId: string,
): Promise<Result<reviewService.DecisionResult>> {
  const auth = await getAdminUser();
  if (!auth.ok) return auth;

  const result = await reviewService.restoreEvent(auth.value, eventId);
  if (result.ok) {
    revalidateSite(result.value.slug);
    revalidateAdminViews(result.value.eventId);
  }

  return result;
}

/**
 * Closing a report (task 9.3).
 *
 * Unlike the four above, these do **not** call `revalidateSite`: closing a
 * report changes nothing a visitor can see. Suspension is what does that, and
 * it is deliberately a separate action reached from the event page — see
 * `closeReport` in the service for why resolving does not imply suspending.
 */
export async function closeReportAction(
  reportId: string,
  status: "RESOLVED" | "DISMISSED",
): Promise<Result<{ reportId: string }>> {
  const auth = await getAdminUser();
  if (!auth.ok) return auth;

  const result = await reportAdminService.closeReport(auth.value, reportId, status);
  if (result.ok) {
    revalidatePath(ADMIN_REPORTS_PATH);
    revalidatePath(adminReportPath(reportId));
  }

  return result;
}
