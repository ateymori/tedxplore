import { Geist, Geist_Mono } from "next/font/google";

/**
 * The application chrome's typefaces (dashboard, editor, admin, auth, marketing).
 *
 * Declared here and applied by each of those group layouts rather than by the
 * root layout — deliberately (task 10.3). The root layout is shared with the
 * public `[site]` route, and a font variable on its `<html>` counts as "used"
 * on every page, so Next.js preloaded Geist on every published event site even
 * though Aurora renders in its own faces and never touches Geist Sans. Scoping
 * the declaration to the app-chrome layouts keeps the preload off event sites,
 * whose only fonts are the template's own (`templates/aurora/fonts.ts`).
 *
 * One module, imported by the four layouts, so the four `Geist()` calls don't
 * fan out — `next/font` dedupes the underlying files, but a single source keeps
 * the weights and subsets in one place.
 */
const sans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const appFontClassName = `${sans.variable} ${mono.variable}`;
