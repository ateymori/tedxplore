import { Archivo, Geist_Mono, Inter } from "next/font/google";

/**
 * Aurora's typefaces.
 *
 * The template owns its fonts rather than inheriting the app's Geist: a
 * published event site shares no visual language with the dashboard (C-1), and
 * a future Template 2 must be able to look completely different without
 * touching the root layout.
 *
 * `next/font` must be called at module scope, so these are constants here and
 * the renderer only applies `auroraFontClassName` to its root element — which
 * is also what keeps the variables scoped to the template subtree.
 */

const display = Archivo({
  subsets: ["latin"],
  variable: "--font-aurora-display",
  /*
   * Exactly one weight, and the number is not arbitrary: `aurora.css` sets
   * `font-weight: 700` on every heading and nothing anywhere sets another, so
   * 700 is the only weight this face is ever rendered at.
   *
   * It previously asked for 600, 700, and 800. Each weight is a separate
   * static font file, so that shipped three — and `next/font` *preloads* them
   * all, putting ~80KB of never-rendered glyphs on the critical path ahead of
   * the hero. Lighthouse measured four font files totalling 136KB competing
   * with the render-blocking CSS, which is what held LCP at 3.8s (task 4.8).
   *
   * If a future heading needs a second weight, add it here *and* expect to pay
   * for it — or switch to the variable font by dropping `weight` entirely,
   * which is one file for the whole range.
   */
  weight: ["700"],
  display: "swap",
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-aurora-body",
  display: "swap",
});

/**
 * The countdown's digits, and the only monospaced type on the site.
 *
 * Aurora owns this rather than borrowing the app's Geist Mono through Tailwind's
 * `font-mono` (task 10.3). Since Geist was moved out of the root layout to keep
 * it off event sites, `--font-geist-mono` no longer exists here — so the
 * template carries its own mono, scoped like the other two. It is the same
 * underlying face `next/font` would otherwise dedupe, now preloaded on the event
 * site because it is genuinely rendered here (unlike Geist Sans ever was).
 */
const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-aurora-mono",
  display: "swap",
});

export const auroraFontClassName = `${display.variable} ${body.variable} ${mono.variable}`;
