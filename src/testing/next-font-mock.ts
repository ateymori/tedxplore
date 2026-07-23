/**
 * A stand-in for `next/font/google` under Vitest.
 *
 * `next/font` is a build-time transform, not a runtime module: outside `next
 * build` the exported font names are not callable at all. Aurora's fonts
 * (`templates/aurora/fonts.ts`) sit in the import graph of the template
 * registry, so without this every test that touches the registry — including
 * ones about slugs and validation that have nothing to do with typography —
 * fails at import time.
 *
 * The values returned are only ever interpolated into a `className`, so a
 * stable placeholder is enough. A test that cared about the real font files
 * would have to be an end-to-end test against a real build (Phase 4.8's
 * Lighthouse pass), not a unit test.
 */
function stub(family: string) {
  return () => ({
    className: `font-${family}`,
    variable: `--font-${family}`,
    style: { fontFamily: family },
  });
}

/**
 * Named exports rather than a catch-all proxy: ESM resolves named imports
 * statically, so a proxy on the default export would leave `Archivo` undefined
 * and fail in exactly the way this mock exists to prevent. Add a line here when
 * a template adopts another face — the failure is immediate and obvious.
 */
export const Archivo = stub("archivo");
export const Inter = stub("inter");
// Aurora's countdown mono (`--font-aurora-mono`).
export const Geist_Mono = stub("geist-mono");

/**
 * `next/font/local` (the app chrome's self-hosted Inter, `app/fonts.ts`) is
 * the same build-time transform under a different import specifier, so it
 * gets its own alias in `vitest.config.ts` pointing back to this file. It's a
 * default export, not named, hence the separate declaration.
 */
export default stub("inter-local");
