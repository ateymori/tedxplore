import { Section, Text } from "@react-email/components";

import { EmailButton, EmailLayout, mutedParagraph, paragraph } from "@/emails/base-layout";

export type SiteRejectedProps = {
  name: string | null;
  eventName: string;
  /** FR-33: required, and the reason this email exists at all. */
  reason: string;
  eventUrl: string;
};

/**
 * FR-48 / FR-33: sent on rejection, always carrying the reviewer's reason.
 *
 * `reason` is a required prop rather than an optional one: an email that says
 * "changes are needed" without saying which is a dead end for the organizer,
 * and making the type refuse to render one is cheaper than remembering.
 *
 * It is reviewer-authored free text, so it renders as text inside a quoted
 * block — never as markup, and never interpolated into the subject line.
 */
export function SiteRejected({ name, eventName, reason, eventUrl }: SiteRejectedProps) {
  return (
    <EmailLayout
      preview={`Changes are needed before ${eventName} can go live`}
      heading="Changes needed before publishing"
    >
      <Text style={paragraph}>
        {name ? `Hi ${name},` : "Hi,"} we reviewed <strong>{eventName}</strong> and it isn&rsquo;t
        ready to publish yet. Here&rsquo;s what our reviewer asked for:
      </Text>

      <Section
        style={{
          backgroundColor: "#f6f6f7",
          borderLeft: "3px solid #d1d1d6",
          borderRadius: "6px",
          margin: "0 0 20px",
          padding: "16px 20px",
        }}
      >
        <Text style={{ ...paragraph, margin: 0, whiteSpace: "pre-wrap" }}>{reason}</Text>
      </Section>

      <Text style={paragraph}>
        Make the changes in your editor and submit again — a resubmission goes through a fresh
        review of the whole site.
      </Text>

      <EmailButton href={eventUrl} label="Edit your event" />

      <Text style={mutedParagraph}>Nothing was deleted. Your draft is exactly as you left it.</Text>
    </EmailLayout>
  );
}

export default SiteRejected;
