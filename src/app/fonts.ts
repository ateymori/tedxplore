import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";

/**
 * The application chrome's typefaces (dashboard, editor, admin, auth, marketing).
 *
 * Declared here and applied by each of those group layouts rather than by the
 * root layout — deliberately (task 10.3). The root layout is shared with the
 * public `[site]` route, and a font variable on its `<html>` counts as "used"
 * on every page, so Next.js would preload this on every published event site
 * even though Aurora renders in its own faces and never touches it. Scoping
 * the declaration to the app-chrome layouts keeps the preload off event sites,
 * whose only fonts are the template's own (`templates/aurora/fonts.ts`).
 *
 * The sans face is Inter, self-hosted from rsms.me rather than pulled through
 * `next/font/google` — Google's Fonts pipeline re-subsets the file and drops
 * OpenType tables the source release ships, including the character-variant
 * features (`cv01`–`cv13`), one of which (`cv11`) is what renders lowercase
 * `a` as the single-story form the app chrome uses everywhere via the
 * `font-feature-settings: 'cv11' 1` rule in `globals.css`. `next/font/local`
 * still gets the preload/`font-display`/CSS-variable machinery that makes
 * `next/font` worth using — it just serves the exact bytes at
 * `./fonts/inter/`, the variable-font files rsms.me itself serves, so the
 * feature tables survive. (Verified against the downloaded file: `cv11` is
 * present in its `GSUB` feature list.)
 *
 * One module, imported by the four layouts, so the calls don't fan out —
 * `next/font` dedupes the underlying files, but a single source keeps the
 * weights and subsets in one place.
 *
 * **`next dev`'s Turbopack compiler has a bug with this specific setup**:
 * it applies the generated `sans_*__variable` class to the DOM correctly but
 * drops the CSS module that actually defines `--font-inter` and the
 * `@font-face` rule from the page's stylesheet links entirely — so `Inter`
 * silently falls back to the browser default and looks unstyled in dev. Both
 * `next build` (Turbopack) and `next dev --webpack` bundle it correctly;
 * verified directly by inspecting each mode's served CSS. Until upstream
 * fixes this, use `pnpm dev:webpack` instead of `pnpm dev` when local
 * typography needs to look right — production (`next build` / Vercel) is
 * unaffected regardless of which one ran locally.
 *
 * **`appFontClassName` must include `font-sans` itself, not just the two
 * `.variable` classes.** `globals.css` sets `font-family: var(--font-sans)`
 * on `html`, but `--font-inter`/`--font-geist-mono` are only *defined* by
 * the `.variable` classes applied to a wrapper `<div>` several levels below
 * `html` (inside each group layout — see above for why it can't move up to
 * `html`). `var()` resolves against the custom property's value *at the
 * element the `var()` is written on*: `html` computes `font-family` once,
 * before that div's `--font-inter` exists anywhere in the tree, locks in the
 * fallback (`ui-sans-serif, system-ui, sans-serif`), and every descendant —
 * including the div that correctly has `--font-inter` sitting right on it —
 * just inherits that already-resolved value. Nothing re-declares
 * `font-family` lower in the tree, so the correct variable was never once
 * read. This is why Geist Sans never rendered as Geist either; it went
 * unnoticed because its fallback stack looks close enough by eye. Adding
 * `font-sans` here re-declares `font-family: var(--font-sans)` on the same
 * div that defines the variable, so the `var()` resolves correctly in that
 * scope. `html`'s own rule still matters — it's what the root-level pages
 * with no group layout (root error/not-found, the public `[site]` 404) fall
 * back to, per the note in `globals.css`.
 */
const sans = localFont({
  src: [
    { path: "./fonts/inter/InterVariable.woff2", style: "normal", weight: "100 900" },
    { path: "./fonts/inter/InterVariable-Italic.woff2", style: "italic", weight: "100 900" },
  ],
  variable: "--font-inter",
  display: "swap",
});
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const appFontClassName = `${sans.variable} ${mono.variable} font-sans`;
