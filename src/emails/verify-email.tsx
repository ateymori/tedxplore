import {
  EmailButton,
  EmailFallbackUrl,
  EmailLayout,
  mutedParagraph,
  paragraph,
} from "@/emails/base-layout";
import { SITE_NAME } from "@/config/site";
import { Text } from "@react-email/components";

export type VerifyEmailProps = {
  /** The user's display name, or null when they signed up without one. */
  name: string | null;
  verifyUrl: string;
  expiresInHours: number;
};

export function VerifyEmail({ name, verifyUrl, expiresInHours }: VerifyEmailProps) {
  return (
    <EmailLayout preview={`Confirm your ${SITE_NAME} email address`} heading="Confirm your email">
      <Text style={paragraph}>
        {name ? `Hi ${name},` : "Hi,"} thanks for signing up for {SITE_NAME}. Confirm this email
        address to activate your account and start building your event site.
      </Text>

      <EmailButton href={verifyUrl} label="Confirm email address" />
      <EmailFallbackUrl href={verifyUrl} />

      <Text style={mutedParagraph}>
        This link expires in {expiresInHours} {expiresInHours === 1 ? "hour" : "hours"}. If you
        didn&apos;t create an account, you can safely ignore this email.
      </Text>
    </EmailLayout>
  );
}

export default VerifyEmail;
