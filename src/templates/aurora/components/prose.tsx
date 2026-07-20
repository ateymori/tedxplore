import { cn } from "@/lib/utils";

import { toParagraphs } from "../lib/text";

/**
 * Renders organizer prose as paragraphs.
 *
 * `whitespace-pre-line` keeps single newlines *inside* a paragraph — an
 * organizer listing three lines under one heading typed those breaks on
 * purpose — while `toParagraphs` turns blank lines into real `<p>` boundaries.
 */
export function AuroraProse({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn("space-y-5", className)}>
      {toParagraphs(text).map((paragraph, index) => (
        // Paragraphs have no identity beyond their position in the text.
        <p key={index} className="whitespace-pre-line">
          {paragraph}
        </p>
      ))}
    </div>
  );
}
