import { Archivo, Inter } from "next/font/google";

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
  // The display face is only ever set at heavy weights; loading the full
  // variable range would ship axis data no heading uses.
  weight: ["600", "700", "800"],
  display: "swap",
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-aurora-body",
  display: "swap",
});

export const auroraFontClassName = `${display.variable} ${body.variable}`;
