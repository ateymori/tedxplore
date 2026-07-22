import "server-only";

import { APP_URL, SITE_NAME, tedxSiteUrl } from "@/config/site";
import { eventPath } from "@/config/routes";
import { SiteApproved } from "@/emails/site-approved";
import { SiteRejected } from "@/emails/site-rejected";
import { SiteSuspended } from "@/emails/site-suspended";
import { SubmissionReceived } from "@/emails/submission-received";
import { sendEmail } from "@/server/adapters/email";
import { captureException } from "@/server/logger";

/**
 * Publishing lifecycle notifications (FR-48).
 *
 * Composition only: which template, to whom, with what subject. The transport
 * is `adapters/email.ts` (invariant 4), so this module stays testable and the
 * console fallback keeps working without a Resend account.
 *
 * ## Why every send here is fire-and-forget
 *
 * Auth's emails are the opposite — a verification message that fails to send
 * must fail the sign-up, because the alternative is an account nobody can ever
 * activate. Publishing is not like that. By the time we send, the state change
 * has already committed: the snapshot exists, the site is live, the suspension
 * is in force. Propagating a Resend outage from here would show the admin
 * "approval failed" for an approval that in fact succeeded, and a retry would
 * then hit `PENDING` having already moved on. Losing a notification about a
 * change the owner can also see in the dashboard is the cheaper failure, so
 * these log and move on.
 */

interface Recipient {
  email: string;
  name: string | null;
}

/**
 * Sends without letting a delivery failure reach the caller.
 *
 * Reported through `captureException` rather than swallowed: this is exactly
 * the sort of failure that looks like nothing at all until an organizer says
 * they were never told their site went live, so it is one of the call sites
 * the task-10.4 monitoring seam exists for.
 */
async function notify(description: string, send: () => Promise<void>): Promise<void> {
  try {
    await send();
  } catch (error) {
    captureException(error, { scope: "publish-notifications", description });
  }
}

export function sendSubmissionReceived(
  owner: Recipient,
  event: { id: string; displayName: string },
): Promise<void> {
  return notify(`submission-received for event ${event.id}`, () =>
    sendEmail({
      to: owner.email,
      subject: `We received your submission for ${event.displayName}`,
      react: (
        <SubmissionReceived
          name={owner.name}
          eventName={event.displayName}
          eventUrl={`${APP_URL}${eventPath(event.id)}`}
        />
      ),
    }),
  );
}

export function sendSiteApproved(
  owner: Recipient,
  event: { id: string; slug: string; displayName: string },
  firstPublication: boolean,
): Promise<void> {
  return notify(`site-approved for event ${event.id}`, () =>
    sendEmail({
      to: owner.email,
      subject: firstPublication
        ? `${event.displayName} is live`
        : `Your changes to ${event.displayName} are live`,
      react: (
        <SiteApproved
          name={owner.name}
          eventName={event.displayName}
          siteUrl={tedxSiteUrl(event.slug)}
          firstPublication={firstPublication}
        />
      ),
    }),
  );
}

export function sendSiteRejected(
  owner: Recipient,
  event: { id: string; displayName: string },
  reason: string,
): Promise<void> {
  return notify(`site-rejected for event ${event.id}`, () =>
    sendEmail({
      to: owner.email,
      // The reason is deliberately not in the subject line: it is free text a
      // reviewer wrote, it can be a paragraph, and subject lines are truncated
      // and shown in notifications the owner may not have chosen to open there.
      subject: `Changes needed before ${event.displayName} can go live`,
      react: (
        <SiteRejected
          name={owner.name}
          eventName={event.displayName}
          reason={reason}
          eventUrl={`${APP_URL}${eventPath(event.id)}`}
        />
      ),
    }),
  );
}

export function sendSiteSuspended(
  owner: Recipient,
  event: { id: string; displayName: string },
  reason: string | null,
): Promise<void> {
  return notify(`site-suspended for event ${event.id}`, () =>
    sendEmail({
      to: owner.email,
      subject: `${event.displayName} has been suspended on ${SITE_NAME}`,
      react: <SiteSuspended name={owner.name} eventName={event.displayName} reason={reason} />,
    }),
  );
}
