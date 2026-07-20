# Tedxplore — Implementation Plan (Version 1)

Tasks are small and sequential within a phase; phases build on each other. Each phase ends with something runnable and reviewable. Estimated sizing: S (< half day), M (half–full day), L (1–2 days) — calibration, not commitments.

---

## Phase 0 — Foundation

**Goal:** a running, deployable skeleton with CI, database, and conventions locked in.

- [x] 0.1 (S) Scaffold Next.js (App Router, TypeScript strict, Tailwind, ESLint, Prettier, `src/` layout).
- [x] 0.2 (S) Install and configure shadcn/ui; set base theme tokens (fonts, colors) for the app chrome.
- [x] 0.3 (S) ~~Create Neon project + branch DB~~; wire Prisma (`DATABASE_URL` pooled + `DIRECT_URL`); empty initial migration pipeline working — verified against local Docker Postgres (tech-stack.md's documented fallback); real Neon project deferred to when Vercel is connected (0.5).
- [x] 0.4 (S) Centralized config: `config/limits.ts` (all content limits), `config/reserved-slugs.ts`, `config/site.ts` (app URL, names).
- [ ] 0.5 (S) CI (GitHub Actions): lint, typecheck, test, build on push — workflow file written, verified locally. Vercel project connected (preview + production) — **pending**, needs Mohammad to run `vercel login`.
- [x] 0.6 (S) Base layout, error/404 pages, health route.

**Exit:** deployed hello-world on Vercel, CI green, DB migration runs.

## Phase 1 — Data Model & Domain Core

**Goal:** full schema + the content contract everything else depends on.

- [x] 1.1 (M) Prisma schema: all V1 models (User/auth tables, Event, Speaker, TeamMember, Sponsor, Faq, MediaAsset, Snapshot, PublishRequest, PreviewToken, Report) + enums; initial migration.
- [x] 1.2 (M) `EventContent` Zod schema + types (`content/event-content.ts`), versioned (`schemaVersion: 1`). Fields named to match the corrected model: `displayName` (required, never blank) and `theme` (optional, max 100 chars — BR-5d); all other fields optional (FR-15a) — schema encodes this directly so no downstream layer can re-require a field ad hoc. Note: the always-rendered-section fallback content (FR-38) is a template-rendering concern, not a schema concern — `theme` stays nullable here, and the renderer supplies the platform default when it's null, so a future update to the default copy automatically applies even to old snapshots.
- [x] 1.3 (M) Draft→content serializer (`content/serializer.ts`) + "usable content" emptiness rules per section (BR-13) + submission completeness check (BR-14). Field-level optionality (FR-15a: only `displayName` required to save a draft) is distinct from, and looser than, the submission completeness gate (BR-14) — keep the two checks separate in code. Unit tests must cover a minimal draft (display name only, no theme, everything else blank) alongside a fully-populated one.
- [x] 1.4 (S) Two independent validators — slug and display name now have unrelated charsets and purposes, so keep them as separate functions rather than deriving one from the other:
  - **Slug validator**: lowercase `a–z` only (no uppercase, digits, spaces, or other characters), 2–50 chars, reserved blocklist, uniqueness on the stored value directly (no case-folding needed — the charset is already lowercase-only).
  - **Display Name validator**: Unicode-aware — letters of any case, spaces, accented letters, and hyphens allowed; digits rejected; not required to be unique. Plus a default-suggestion generator (`TEDx` + capitalized slug, e.g. slug `mcgillu` → suggested "TEDxMcgillu") that the create-event form pre-fills but the user can freely overwrite (e.g., to "TEDxMcGill University").
  - Unit tests for both, including accented/Unicode input for display name.
- [x] 1.5 (S) Repository layer skeleton + service-result types (discriminated unions for domain errors).
- [x] 1.6 (S) Seed script: admin user, one demo event.

**Exit:** `pnpm test` covers slug rules, serializer, completeness; schema migrated.

## Phase 2 — Authentication

**Goal:** complete auth lifecycle with email.

- [ ] 2.1 (M) Better Auth setup: email/password + Google OAuth, Prisma adapter, session handling, `role` on User.
- [ ] 2.2 (S) Resend adapter + React Email base layout; verification and password-reset emails.
- [ ] 2.3 (M) Auth UI: sign up, sign in, verify-email, forgot/reset password pages (shadcn forms, Zod).
- [ ] 2.4 (S) Route protection: middleware/guards for `(app)` (authenticated + verified) and `/admin` (ADMIN role); `requireUser`/`requireAdmin` helpers for actions/handlers. Include generic post-login `returnTo` redirect support (land back on the originally requested destination after auth) — needed by any unauthenticated entry point, notably the homepage's Edit button (FR-51, Phase 4).

**Exit:** full signup → verify → login → reset flows work on a deployed preview.

## Phase 3 — Event Creation & Dashboard

**Goal:** organizers can create and manage events (no editor yet).

- [ ] 3.1 (M) Create-event flow: two decoupled inputs — slug (lowercase-only, live `tedxplore.com/tedx{slug}` URL preview and availability check) and display name (pre-filled with the suggested default from 1.4, freely editable in its own richer charset, shown as it will actually appear in the header/nav) — plus authorization checkbox, TED page URL, license holder name; creates draft **seeded with template demo content**.
- [ ] 3.2 (M) Dashboard: event cards (name, slug, publication status, review status, last edited), empty state, create CTA.
- [ ] 3.3 (S) Event settings page: edit display name (freely editable anytime, reuses the 1.4 validator) and licensing info; slug editing (only while `NEVER_PUBLISHED`, locked thereafter).
- [ ] 3.4 (M) Delete flow: confirmation dialog; hard delete for never-published, soft delete otherwise; slug release rules. Service + tests.

**Exit:** create, list, rename, delete events end-to-end.

## Phase 4 — Template "Aurora" (public renderer)

**Goal:** the V1 template, fully polished, rendering from `EventContent` alone. Built early so the editor always has a real preview target.

- [ ] 4.1 (M) Template shell: registry entry, layout, typography scale, color system, motion primitives (scroll reveal, parallax restraint, `prefers-reduced-motion`), smooth scrolling + section nav.
- [ ] 4.2 (M) Hero (renders Display Name, always present; Theme as the subtitle when set, otherwise falls back to platform-provided default subtitle copy; hero/background imagery when uploaded, otherwise falls back to a default template visual — both per FR-38, never blank/omitted) + Countdown (incl. "This event has taken place." state) + Register/Get Tickets button.
- [ ] 4.3 (M) About + Venue (map-free: imagery, address, description) sections.
- [ ] 4.4 (M) Speakers section (grid, detail interaction, photos, talk titles) + Team section.
- [ ] 4.5 (M) Sponsors (tier groups, auto-hiding tiers) + FAQ (accessible accordion).
- [ ] 4.6 (S) Contact, About TED, About TEDx, disclaimer, required footer. About TED, About TEDx, and the disclaimer are static platform-authored copy (no organizer-editable portion in V1 — FR-38): render verbatim, no conditional/fallback logic needed. Footer's optional organizer elements (contact, social links) individually hide when blank, same as elsewhere.
- [ ] 4.7 (M) Demo content authoring (high-quality placeholder copy + imagery) → `demoContent`; author the Hero's platform-default subtitle and default background visual (used whenever Theme or hero imagery is unset — FR-38). Verify the two fallback behaviors distinctly and don't conflate them: always-rendered sections show the platform default when organizer content is blank (FR-38 — e.g., clear Theme and hero image → default subtitle + default visual appear, section never disappears), while optional sections auto-hide entirely when empty (BR-13 — e.g., clear all speakers → Speakers section disappears; no default content is ever shown for these).
- [ ] 4.8 (M) Polish pass: responsive audit (360 px → 4K), accessibility audit (keyboard, contrast, semantics, alt text), Lighthouse ≥ 90, image optimization via Cloudinary URLs.
- [ ] 4.9 (M) Public homepage & template browsing (FR-49–FR-51): unauthenticated, browsable template grid — V1 shows a single `aurora` card, but the grid/card component is built to scale to the future multi-template gallery (NFR-6, roadmap item 1). Each card has **Live Preview** (opens `demoContent` rendered through the real template in a new tab, no auth) and **Edit** (unauthenticated → redirects to login/signup with `returnTo` the create-event flow for that `templateId`, using the redirect support from 2.4; authenticated → goes straight to event creation, Phase 3.1).

**Exit:** `/preview` of demo content is a portfolio-quality site, the public homepage showcases it end-to-end via Live Preview and the Edit → auth → create-event handoff, and a minimal draft (slug + display name only, everything else blank) still renders a complete-looking site — always-rendered sections fall back to platform defaults, optional sections cleanly disappear.

## Phase 5 — Structured Editor

**Goal:** the CMS-like editing experience.

- [ ] 5.1 (M) Editor shell: section navigation, per-section forms layout, autosave status indicator (`Saving…/Saved/Save failed/Unsaved changes`) + "Save now".
- [ ] 5.2 (M) Autosave engine: debounced per-section Server Actions, optimistic status, failure retry, concurrent-session last-write-wins warning.
- [ ] 5.3 (M) Basics sections: hero (**display name** — required on every save, per FR-15a; **theme** — optional, ≤100 chars, BR-5d; UI hints that leaving it blank shows a tasteful platform default rather than nothing, FR-38), about, event date/time + timezone, contact + social links, registration URL (all optional; missing values just leave the corresponding section/state empty, not an error).
- [ ] 5.4 (M) Cloudinary signed upload flow + `MediaAsset` recording + reusable image-field component (upload, replace, remove, validation errors).
- [ ] 5.5 (L) List editors — speakers, team, sponsors (with tier select), FAQs: add/edit/remove/reorder (drag handle), limits from central config, inline validation. Every list may stay empty indefinitely (no minimum count) — empty is a valid, common draft state (FR-15a), not an error.
- [ ] 5.6 (S) Venue section editor (name, address, description, image).
- [ ] 5.7 (S) Owner draft preview: render current draft through the template (`mode: "preview"`), linked from editor and dashboard.

**Exit:** full content lifecycle: edit everything, autosave, preview the real site.

## Phase 6 — Preview Links

**Goal:** shareable read-only draft previews.

- [ ] 6.1 (S) PreviewToken service: create/revoke/regenerate (single active token), 256-bit tokens.
- [ ] 6.2 (S) `/preview/[token]` route: validates token, renders draft via template, `noindex` headers; branded invalid/revoked page.
- [ ] 6.3 (S) Dashboard/editor UI: create link, copy, revoke, regenerate.

**Exit:** teammate without an account can view a draft; revocation works instantly.

## Phase 7 — Publishing Workflow & Admin

**Goal:** the draft → review → live pipeline.

- [ ] 7.1 (M) Submit flow: completeness check with actionable errors → snapshot creation → PublishRequest (enforce single pending) → cancel pending; status surfaced on dashboard + "submission received" email.
- [ ] 7.2 (M) Admin review queue: pending list, request detail rendering the exact snapshot via template, ownership/licensing panel (TED URL, license holder, authorization timestamp).
- [ ] 7.3 (M) Approve/reject services: atomic approval (live snapshot swap + status), required rejection reason; approval/rejection emails; cache revalidation on approval.
- [ ] 7.4 (S) Owner controls: unpublish/republish (republish of an existing approved snapshot needs no review; changed content goes through review as normal).
- [ ] 7.5 (S) Admin suspend/restore + suspension email + cache revalidation.
- [ ] 7.6 (M) Admin events index: search by slug/owner, event detail (history of requests/snapshots), soft-deleted visibility.

**Exit:** full lifecycle demo: edit → submit → approve → live → edit → resubmit → reject → revise → approve.

## Phase 8 — Public Site Serving

**Goal:** fast, correct public rendering.

- [ ] 8.1 (M) Public site route: a top-level `src/app/[site]/` segment serving `tedxplore.com/tedx{slug}` as a path on the main app (not a subdomain). The segment arrives whole (`tedxmcgillu`); use `parseTedxSegment` from `config/site.ts` to strip the prefix — a folder named `tedx[slug]` does not work, partial dynamic segments are unsupported. Then resolve slug → live snapshot → render (`mode: "public"`); static rendering + cache tags, revalidated by approve/unpublish/suspend; branded unavailable page for all non-live states.
- [ ] 8.2 (S) SEO: per-site metadata, Open Graph/Twitter cards from event imagery, canonical URLs; sitemap of published sites; robots rules (exclude previews).
- [ ] 8.3 (S) Snapshot schema-version upgrader scaffold (v1 passthrough) so old snapshots keep rendering after future `EventContent` changes.

**Exit:** published sites load fast globally with correct SEO and lifecycle behavior.

## Phase 9 — Reporting & Abuse Protection

- [ ] 9.1 (S) Report UI on public sites: discreet footer link → form (category, explanation, optional email) with honeypot.
- [ ] 9.2 (M) Report handler: validation, IP-hash rate limiting (DB fixed-window, 3/hour/site), Report persistence; expired rate-limit rows cleaned up (opportunistic on write + periodic Vercel cron sweep).
- [ ] 9.3 (S) Admin report inbox: list, detail with site link, resolve/dismiss, jump to suspend.
- [ ] 9.4 (S) Rate-limit adapter applied to preview-token guessing and auth-sensitive endpoints.

**Exit:** visitor can report; admin can act; abuse is bounded.

## Phase 10 — Hardening & Launch

- [ ] 10.1 (M) E2E smoke suite (Playwright): homepage → Live Preview; homepage → Edit → login → create → edit → submit → approve → public view; report flow; preview link flow.
- [ ] 10.2 (S) Security pass: authorization audit on every action/handler, header hardening (CSP for public sites), URL/output sanitization review.
- [ ] 10.3 (S) Accessibility + performance final audit (app and public template).
- [ ] 10.4 (S) Operational polish: error monitoring hook points, structured logging in services, orphaned-media cleanup script.
- [ ] 10.5 (S) Homepage polish: finalize value-proposition copy and SEO metadata around the template grid built in 4.9; verify the Live Preview and Edit → login → create-event handoff end-to-end (do not rebuild — the homepage itself ships in Phase 4).
- [ ] 10.6 (S) Production env setup, domain, seed admin, launch checklist run.

**Exit:** production launch.

---

## Sequencing notes

- **Template before editor** (Phase 4 before 5) is deliberate: the editor's preview and the demo-content seed both depend on the template, and building the renderer first proves the `EventContent` contract before the editor writes to it.
- **Public homepage (4.9) sits at the end of Phase 4**, not earlier or in Phase 10: Live Preview needs the template renderer + `demoContent` to exist, and Edit needs both the auth redirect support (2.4) and the create-event flow (3.1) already built. Phase 4 is the earliest point all three dependencies are satisfied.
- Phases 4 and 5 are the bulk of the visible product; each of their tasks is independently reviewable.
- Anything that touches the `EventContent` schema after Phase 1 must update the serializer, Zod schema, template, and (from Phase 8 on) the snapshot upgrader together — treated as one change.

## Definition of Done (every task)

- Typechecks, lints, unit tests for domain logic pass.
- Authorization enforced on any new mutation.
- Limits/validation come from central config.
- UI states covered: loading, empty, error, success.
- Responsive + keyboard accessible where UI is involved.
