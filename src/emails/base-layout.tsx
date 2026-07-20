// Shared shell for every transactional email the platform sends.
//
// Email clients strip <style> blocks and ignore most modern CSS, so everything
// here is inline styles on tables-friendly primitives from React Email. This is
// intentionally *not* Tailwind — the app's design system doesn't survive the
// trip through Gmail/Outlook.

import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { SITE_DOMAIN, SITE_NAME } from "@/config/site";

const styles = {
  body: {
    backgroundColor: "#f6f6f7",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    margin: 0,
    padding: "32px 0",
  },
  container: {
    backgroundColor: "#ffffff",
    border: "1px solid #e6e6e8",
    borderRadius: "12px",
    margin: "0 auto",
    maxWidth: "560px",
    padding: "40px",
  },
  brand: {
    color: "#111113",
    fontSize: "18px",
    fontWeight: 600,
    letterSpacing: "-0.01em",
    margin: "0 0 32px",
  },
  heading: {
    color: "#111113",
    fontSize: "24px",
    fontWeight: 600,
    letterSpacing: "-0.02em",
    lineHeight: "32px",
    margin: "0 0 16px",
  },
  hr: {
    border: "none",
    borderTop: "1px solid #e6e6e8",
    margin: "32px 0 24px",
  },
  footer: {
    color: "#8a8a90",
    fontSize: "12px",
    lineHeight: "18px",
    margin: 0,
  },
} as const;

/** Body copy. Exported so each template styles its paragraphs identically. */
export const paragraph = {
  color: "#3a3a3f",
  fontSize: "15px",
  lineHeight: "24px",
  margin: "0 0 16px",
} as const;

/** Small print — used for expiry notes and "didn't request this?" lines. */
export const mutedParagraph = {
  color: "#8a8a90",
  fontSize: "13px",
  lineHeight: "20px",
  margin: "0 0 8px",
} as const;

type EmailLayoutProps = {
  /** Inbox preview line. Keep it distinct from the heading. */
  preview: string;
  heading: string;
  children: React.ReactNode;
};

export function EmailLayout({ preview, heading, children }: EmailLayoutProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Text style={styles.brand}>{SITE_NAME}</Text>
          <Heading style={styles.heading}>{heading}</Heading>
          <Section>{children}</Section>
          <Hr style={styles.hr} />
          <Text style={styles.footer}>
            {SITE_NAME} — <Link href={`https://${SITE_DOMAIN}`}>{SITE_DOMAIN}</Link>
            <br />
            This is an automated message; replies aren&apos;t monitored.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

/**
 * The primary call-to-action.
 *
 * Rendered as an anchor rather than React Email's `<Button>` so the same
 * element works in clients that refuse table-based buttons, and always paired
 * with the raw URL below it — some clients strip links entirely, and a
 * verification email that can't be actioned is a dead end.
 */
export function EmailButton({ href, label }: { href: string; label: string }) {
  return (
    <Section style={{ margin: "24px 0" }}>
      <Link
        href={href}
        style={{
          backgroundColor: "#111113",
          borderRadius: "8px",
          color: "#ffffff",
          display: "inline-block",
          fontSize: "15px",
          fontWeight: 500,
          padding: "12px 24px",
          textDecoration: "none",
        }}
      >
        {label}
      </Link>
    </Section>
  );
}

export function EmailFallbackUrl({ href }: { href: string }) {
  return (
    <>
      <Text style={mutedParagraph}>
        If the button doesn&apos;t work, paste this link into your browser:
      </Text>
      <Text style={{ ...mutedParagraph, wordBreak: "break-all" }}>
        <Link href={href}>{href}</Link>
      </Text>
    </>
  );
}
