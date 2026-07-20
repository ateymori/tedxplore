import { z } from "zod";

/**
 * BR-12: every user-provided URL must be http/https.
 *
 * This is a security boundary as much as a formatting rule — it is what keeps
 * `javascript:`, `data:`, and `vbscript:` URLs out of `href` attributes on
 * public sites. Rendering additionally applies `rel="noopener noreferrer"`.
 */
export const externalUrlSchema = z.url({
  protocol: /^https?$/,
  hostname: z.regexes.domain,
  error: "Enter a full web address starting with http:// or https://",
});

export function isValidExternalUrl(value: string): boolean {
  return externalUrlSchema.safeParse(value).success;
}
