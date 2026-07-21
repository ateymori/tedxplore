import { Section, Text } from "@react-email/components";

import { EmailLayout, mutedParagraph, paragraph } from "@/emails/base-layout";
import { SITE_NAME, SUPPORT_EMAIL } from "@/config/site";

export type SiteSuspendedProps = {
  name: string | null;
  eventName: string;
  /** The admin's explanation. Optional — some suspensions are urgent. */
  reason: string | null;
};

/**
 * FR-44 / FR-48: sent when an admin takes a site offline.
 *
 * Carries no link to the site (it is offline) and no call-to-action button: the
 * only thing the owner can do is reply, and the one route back — an admin
 * restoring it — is not something a button can start. Making that explicit is
 * kinder than a button that leads nowhere.
 *
 * `reason` is nullable here where rejection's is required. A rejection is a
 * review decision and is worthless without its reason; a suspension may be an
 * urgent response to abuse, and delaying it to compose an explanation would be
 * the wrong trade.
 */
export function SiteSuspended({ name, eventName, reason }: SiteSuspendedProps) {
  return (
    <EmailLayout
      preview={`${eventName} has been taken offline`}
      heading="Your site has been suspended"
    >
      <Text style={paragraph}>
        {name ? `Hi ${name},` : "Hi,"} <strong>{eventName}</strong> has been suspended by the{" "}
        {SITE_NAME} team and is no longer publicly accessible.
      </Text>

      {reason === null ? null : (
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
      )}

      <Text style={paragraph}>
        Your content hasn&rsquo;t been deleted, and only our team can restore the site. If you think
        this was a mistake, reply to this address and we&rsquo;ll take another look.
      </Text>

      <Text style={mutedParagraph}>Questions: {SUPPORT_EMAIL}</Text>
    </EmailLayout>
  );
}

export default SiteSuspended;
