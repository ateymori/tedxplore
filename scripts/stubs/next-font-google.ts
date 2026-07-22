/**
 * Runtime stub for `next/font/google`.
 *
 * `next/font/google` is a build-time transform with no runtime implementation,
 * so importing it outside `next build` throws. It sits in the template
 * registry's import graph (via `event-service`), which means *any* script that
 * touches the service layer hits it — and running services from a plain Node
 * script is how every phase has been verified against the real database.
 *
 * Mapped in `tsconfig.script.json`, alongside `server-only` → its own
 * `empty.js`. tsx resolves both through CJS, so an ESM loader hook never fires
 * and tsconfig `paths` is the shim that actually works.
 *
 * Not to be confused with `src/testing/next-font-mock.ts`, which does the same job
 * for Vitest through a Vite alias.
 */
type LoadedFont = { className: string; variable: string; style: Record<string, string> };

const font = (): LoadedFont => ({ className: "", variable: "", style: {} });

export const Archivo = font;
export const Geist = font;
export const Geist_Mono = font;
export const Inter = font;
