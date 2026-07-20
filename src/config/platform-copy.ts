/**
 * Platform-authored copy that every public event site must show verbatim.
 *
 * Lives in `config/` rather than inside `src/templates/aurora/` for two
 * reasons. It is required by TED's licensing terms (A-2, FR-37), so a second
 * template must not be able to reword or omit it — a template chooses the
 * typography, never the text. And it is deliberately *not* in `EventContent`:
 * snapshots are immutable, so copy frozen into them could never be corrected,
 * whereas keeping it here means an improvement applies to every site already
 * published (the same reasoning as the FR-38 hero defaults).
 *
 * Organizers cannot edit any of this in V1 (FR-38) — there is no editor field,
 * and there is no fallback logic to write, because there is nothing to fall
 * back from.
 */

/** FR-37: required on every published site, verbatim. */
export const TEDX_DISCLAIMER = "This independent TEDx event is operated under license from TED.";

export const ABOUT_TED = {
  heading: "About TED",
  body: [
    "TED is a nonprofit organization devoted to ideas worth spreading, usually in the form of short talks delivered by leading thinkers and doers. Many of these talks are given at TED conferences, and the best are made available, free, on TED.com.",
    "TED speakers have included Bill Gates, Jane Goodall, Elizabeth Gilbert, Sir Richard Branson, Nandan Nilekani, Philippe Starck, Ngozi Okonjo-Iweala, Sal Khan and Daniel Kahneman. TED's open and free initiatives for spreading ideas include TED.com, the TED Translators program, the educational initiative TED-Ed, and the annual TED Prize.",
  ],
  linkLabel: "ted.com",
  linkUrl: "https://www.ted.com",
} as const;

export const ABOUT_TEDX = {
  heading: "About TEDx",
  // The standard formulation, including the expansion of the "x" — TED asks
  // that both appear together.
  subheading: "x = independently organized event",
  body: [
    "In the spirit of ideas worth spreading, TEDx is a program of local, self-organized events that bring people together to share a TED-like experience. At a TEDx event, TED Talks video and live speakers combine to spark deep discussion and connection.",
    "These local, self-organized events are branded TEDx, where x = independently organized TED event. The TED Conference provides general guidance for the TEDx program, but individual TEDx events are self-organized, subject to certain rules and regulations.",
  ],
  linkLabel: "ted.com/tedx",
  linkUrl: "https://www.ted.com/participate/organize-a-local-tedx-event",
} as const;

/**
 * The Hero's fallback subtitle when the organizer has not set a Theme
 * (FR-38, BR-5d).
 *
 * Written to be true of every TEDx event and to read as an intentional
 * tagline rather than as absent content — a visitor should not be able to tell
 * that a field was left blank. Templates supply their own default *visual*;
 * only the words are shared.
 */
export const DEFAULT_HERO_SUBTITLE =
  "An independent TEDx event, in the spirit of ideas worth spreading.";
