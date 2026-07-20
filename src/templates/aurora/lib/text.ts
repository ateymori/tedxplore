/**
 * Organizer prose is plain text, never HTML or Markdown — the editor (Phase 5)
 * offers a textarea, and rendering user HTML on a public page would be an
 * injection surface for no product gain.
 *
 * The one structure worth honouring is the paragraph break the organizer
 * actually typed. Splitting on blank lines and rendering real `<p>` elements
 * keeps their intent without giving them a markup language; `white-space:
 * pre-line` would achieve something similar but leaves it as one paragraph to
 * a screen reader and to text-wrapping.
 */
export function toParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}
