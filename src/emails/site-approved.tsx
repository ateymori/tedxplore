import { Text } from "@react-email/components";

import {
  EmailButton,
  EmailFallbackUrl,
  EmailLayout,
  mutedParagraph,
  paragraph,
} from "@/emails/base-layout";

export type SiteApprovedProps = {
  name: string | null;
  eventName: string;
  /** The public site — the whole point of the message. */
  siteUrl: string;
  /** True on the first approval, false when this replaced a live snapshot. */
  firstPublication: boolean;
};

/**
 * FR-48: sent on approval.
 *
 * The public URL is repeated as plain text below the button because this is the
 * one email people forward and paste — the address itself is the payload, and
 * clients that strip links would otherwise leave the recipient with nothing.
 */
export function SiteApproved({ name, eventName, siteUrl, firstPublication }: SiteApprovedProps) {
  return (
    <EmailLayout
      preview={`${eventName} is live`}
      heading={firstPublication ? "Your site is live" : "Your changes are live"}
    >
      <Text style={paragraph}>
        {name ? `Hi ${name},` : "Hi,"}{" "}
        {firstPublication ? (
          <>
            <strong>{eventName}</strong> has been approved and is now published. Anyone with the
            link can visit it.
          </>
        ) : (
          <>
            Your latest submission for <strong>{eventName}</strong> has been approved, and the
            updated site has replaced the previous version.
          </>
        )}
      </Text>

      <EmailButton href={siteUrl} label="View your site" />
      <EmailFallbackUrl href={siteUrl} />

      <Text style={mutedParagraph}>
        You can keep editing at any time. Further changes stay in your draft until you submit them
        for review, so the live site never changes underneath your visitors.
      </Text>
    </EmailLayout>
  );
}

export default SiteApproved;
