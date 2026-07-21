import { Text } from "@react-email/components";

import { EmailButton, EmailLayout, mutedParagraph, paragraph } from "@/emails/base-layout";
import { SITE_NAME } from "@/config/site";

export type SubmissionReceivedProps = {
  /** The organizer's display name, or null when they signed up without one. */
  name: string | null;
  eventName: string;
  /** Back to the editor — the one useful action while waiting. */
  eventUrl: string;
};

/**
 * FR-48: sent when a publish request enters the queue.
 *
 * Deliberately sets no expectation about *when* review happens: V1 has a single
 * admin reviewing by hand, and a promised turnaround we cannot keep is worse
 * than none. It does say the draft stays editable (FR-31), which is the thing
 * organizers most often assume is now frozen.
 */
export function SubmissionReceived({ name, eventName, eventUrl }: SubmissionReceivedProps) {
  return (
    <EmailLayout
      preview={`We received your submission for ${eventName}`}
      heading="Submission received"
    >
      <Text style={paragraph}>
        {name ? `Hi ${name},` : "Hi,"} thanks for submitting <strong>{eventName}</strong> for
        review. Our team will look over the whole site and get back to you by email with the
        outcome.
      </Text>

      <Text style={paragraph}>
        You can keep editing your draft in the meantime — your changes won&rsquo;t affect this
        submission, and they won&rsquo;t go live until you submit them for review too.
      </Text>

      <EmailButton href={eventUrl} label="Open your event" />

      <Text style={mutedParagraph}>
        Changed your mind? You can cancel a pending submission from your {SITE_NAME} dashboard at
        any time before it&rsquo;s reviewed.
      </Text>
    </EmailLayout>
  );
}

export default SubmissionReceived;
