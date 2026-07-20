import {
  EmailButton,
  EmailFallbackUrl,
  EmailLayout,
  mutedParagraph,
  paragraph,
} from "@/emails/base-layout";
import { SITE_NAME } from "@/config/site";
import { Text } from "@react-email/components";

export type ResetPasswordEmailProps = {
  name: string | null;
  resetUrl: string;
  expiresInHours: number;
};

export function ResetPasswordEmail({ name, resetUrl, expiresInHours }: ResetPasswordEmailProps) {
  return (
    <EmailLayout preview={`Reset your ${SITE_NAME} password`} heading="Reset your password">
      <Text style={paragraph}>
        {name ? `Hi ${name},` : "Hi,"} we received a request to reset the password for your{" "}
        {SITE_NAME} account. Choose a new one using the link below.
      </Text>

      <EmailButton href={resetUrl} label="Choose a new password" />
      <EmailFallbackUrl href={resetUrl} />

      <Text style={mutedParagraph}>
        This link expires in {expiresInHours} {expiresInHours === 1 ? "hour" : "hours"} and can only
        be used once.
      </Text>
      <Text style={mutedParagraph}>
        If you didn&apos;t request a password reset, no action is needed — your current password
        still works.
      </Text>
    </EmailLayout>
  );
}

export default ResetPasswordEmail;
