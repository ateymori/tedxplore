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

- [x] 2.1 (M) Better Auth setup: email/password + Google OAuth, Prisma adapter, session handling, `role` on User.
- [x] 2.2 (S) Resend adapter + React Email base layout; verification and password-reset emails.
- [x] 2.3 (M) Auth UI: sign up, sign in, verify-email, forgot/reset password pages (shadcn forms, Zod).
- [x] 2.4 (S) Route protection: middleware/guards for `(app)` (authenticated + verified) and `/admin` (ADMIN role); `requireUser`/`requireAdmin` helpers for actions/handlers. Include generic post-login `returnTo` redirect support (land back on the originally requested destination after auth) — needed by any unauthenticated entry point, notably the homepage's Edit button (FR-51, Phase 4).

**Exit:** full signup → verify → login → reset flows work on a deployed preview.

## Phase 3 — Event Creation & Dashboard

**Goal:** organizers can create and manage events (no editor yet).

- [x] 3.0 (S) **Added during Phase 3** — template registry (`src/templates/registry.ts` + `types.ts`) and the `aurora` demo seed, pulled forward from Phase 4 because 3.1's "seeded with demo content" (FR-10, A-6) cannot exist without it. The seed is authored in _draft_ shape and `demoContent` is derived from it through the real serializer, so the seeded draft and the Live Preview document provably match. `Renderer` is deliberately not on `TemplateDefinition` yet — 4.1 adds it. Copy/imagery remain placeholder until 4.7.
- [x] 3.1 (M) Create-event flow: two decoupled inputs — slug (lowercase-only, live `tedxplore.com/tedx{slug}` URL preview and availability check) and display name (pre-filled with the suggested default from 1.4, freely editable in its own richer charset, shown as it will actually appear in the header/nav) — plus authorization checkbox, TED page URL, license holder name; creates draft **seeded with template demo content**.
- [x] 3.2 (M) Dashboard: event cards (name, slug, publication status, review status, last edited), empty state, create CTA.
- [x] 3.3 (S) Event settings page: edit display name (freely editable anytime, reuses the 1.4 validator) and licensing info; slug editing (only while `NEVER_PUBLISHED`, locked thereafter).
- [x] 3.4 (M) Delete flow: confirmation dialog; hard delete for never-published, soft delete otherwise; slug release rules. Service + tests.

**Exit:** create, list, rename, delete events end-to-end.

## Phase 4 — Template "Aurora" (public renderer)

**Goal:** the V1 template, fully polished, rendering from `EventContent` alone. Built early so the editor always has a real preview target.

- [x] 4.1 (M) Template shell: the registry entry already exists (3.0) — add `Renderer` to `TemplateDefinition` and build it. Layout, typography scale, color system, motion primitives (scroll reveal, parallax restraint, `prefers-reduced-motion`), smooth scrolling + section nav.
- [x] 4.2 (M) Hero (renders Display Name, always present; Theme as the subtitle when set, otherwise falls back to platform-provided default subtitle copy; hero/background imagery when uploaded, otherwise falls back to a default template visual — both per FR-38, never blank/omitted) + Countdown (incl. "This event has taken place." state) + Register/Get Tickets button.
- [x] 4.3 (M) About + Venue (map-free: imagery, address, description) sections.
- [x] 4.4 (M) Speakers section (grid, detail interaction, photos, talk titles) + Team section.
- [x] 4.5 (M) Sponsors (tier groups, auto-hiding tiers) + FAQ (accessible accordion).
- [x] 4.6 (S) Contact, About TED, About TEDx, disclaimer, required footer. About TED, About TEDx, and the disclaimer are static platform-authored copy (no organizer-editable portion in V1 — FR-38): render verbatim, no conditional/fallback logic needed. Footer's optional organizer elements (contact, social links) individually hide when blank, same as elsewhere.
- [x] 4.7 (M) Demo content authoring — the seed's _shape_ shipped in 3.0 (`src/templates/aurora/demo-content.ts`); this task replaces its placeholder copy with final authored prose and adds the imagery. High-quality placeholder copy + imagery → `demoContent`; author the Hero's platform-default subtitle and default background visual (used whenever Theme or hero imagery is unset — FR-38). Verify the two fallback behaviors distinctly and don't conflate them: always-rendered sections show the platform default when organizer content is blank (FR-38 — e.g., clear Theme and hero image → default subtitle + default visual appear, section never disappears), while optional sections auto-hide entirely when empty (BR-13 — e.g., clear all speakers → Speakers section disappears; no default content is ever shown for these). **Imagery is deliberately not part of the delivered seed** — demo content cannot reference `MediaAsset` rows that do not exist and Cloudinary uploads arrive in 5.4, so an image-free seed is what makes every new event exercise the FR-38 hero fallback and the portrait monograms from day one. The Hero's default _visual_ (the thing 4.7 actually owes) ships as `AuroraBackdrop`. Both fallback rules are now pinned by tests that render the real renderer (`src/templates/aurora/fallbacks.test.tsx`), rather than being verified once by eye.
- [x] 4.8 (M) Polish pass: responsive audit (360 px → 4K), accessibility audit (keyboard, contrast, semantics, alt text), Lighthouse ≥ 90, image optimization via Cloudinary URLs. Measured with Lighthouse against a production build, not by eye — final: preview page perf 90–91 / a11y 100 / best-practices 100, homepage perf 93 / a11y 100 / best-practices 100 / SEO 100. Four defects found and fixed: the CTA's hover state failed contrast (white on `aurora-ember`, 2.91:1 — hovering made the button _less_ legible; added `aurora-red-deep` at 6.97:1); the footer copyright failed at 3.68:1; the nav wordmark couldn't shrink, so a long display name pushed the menu button off a 360px viewport; and Archivo was requested at three weights when only 700 is ever rendered, preloading ~80KB of unused glyphs ahead of the hero — which was what held LCP at 3.8s.
- [x] 4.9 (M) Public homepage & template browsing (FR-49–FR-51): unauthenticated, browsable template grid — V1 shows a single `aurora` card, but the grid/card component is built to scale to the future multi-template gallery (NFR-6, roadmap item 1). Each card has **Live Preview** (opens `demoContent` rendered through the real template in a new tab, no auth) and **Edit** (unauthenticated → redirects to login/signup with `returnTo` the create-event flow for that `templateId`, using the redirect support from 2.4; authenticated → goes straight to event creation, Phase 3.1).

**Exit:** `/preview` of demo content is a portfolio-quality site, the public homepage showcases it end-to-end via Live Preview and the Edit → auth → create-event handoff, and a minimal draft (slug + display name only, everything else blank) still renders a complete-looking site — always-rendered sections fall back to platform defaults, optional sections cleanly disappear.

## Phase 5 — Structured Editor

**Goal:** the CMS-like editing experience.

- [x] 5.1 (M) Editor shell: section navigation, per-section forms layout, autosave status indicator (`Saving…/Saved/Save failed/Unsaved changes`) + "Save now".
- [x] 5.2 (M) Autosave engine: debounced per-section Server Actions, optimistic status, failure retry, concurrent-session last-write-wins warning.
- [x] 5.3 (M) Basics sections: hero (**display name** — required on every save, per FR-15a; **theme** — optional, ≤100 chars, BR-5d; UI hints that leaving it blank shows a tasteful platform default rather than nothing, FR-38), about, event date/time + timezone, contact + social links, registration URL (all optional; missing values just leave the corresponding section/state empty, not an error).
- [x] 5.4 (M) Cloudinary signed upload flow + `MediaAsset` recording + reusable image-field component (upload, replace, remove, validation errors).
- [x] 5.5 (L) List editors — speakers, team, sponsors (with tier select), FAQs: add/edit/remove/reorder (drag handle), limits from central config, inline validation. Every list may stay empty indefinitely (no minimum count) — empty is a valid, common draft state (FR-15a), not an error.
- [x] 5.6 (S) Venue section editor (name, address, description, image).
- [x] 5.7 (S) Owner draft preview: render current draft through the template (`mode: "preview"`), linked from editor and dashboard.

**Exit:** full content lifecycle: edit everything, autosave, preview the real site.

## Phase 6 — Preview Links

**Goal:** shareable read-only draft previews.

- [x] 6.1 (S) PreviewToken service: create/revoke/regenerate (single active token), 256-bit tokens.
- [x] 6.2 (S) `/preview/[token]` route: validates token, renders draft via template, `noindex` headers; branded invalid/revoked page.
- [x] 6.3 (S) Dashboard/editor UI: create link, copy, revoke, regenerate.

**Exit:** teammate without an account can view a draft; revocation works instantly.

## Phase 7 — Publishing Workflow & Admin

**Goal:** the draft → review → live pipeline.

- [x] 7.1 (M) Submit flow: completeness check with actionable errors → snapshot creation → PublishRequest (enforce single pending) → cancel pending; status surfaced on dashboard + "submission received" email.
- [x] 7.2 (M) Admin review queue: pending list, request detail rendering the exact snapshot via template, ownership/licensing panel (TED URL, license holder, authorization timestamp).
- [x] 7.3 (M) Approve/reject services: atomic approval (live snapshot swap + status), required rejection reason; approval/rejection emails; cache revalidation on approval.
- [x] 7.4 (S) Owner controls: unpublish/republish (republish of an existing approved snapshot needs no review; changed content goes through review as normal).
- [x] 7.5 (S) Admin suspend/restore + suspension email + cache revalidation.
- [x] 7.6 (M) Admin events index: search by slug/owner, event detail (history of requests/snapshots), soft-deleted visibility.

**Exit:** full lifecycle demo: edit → submit → approve → live → edit → resubmit → reject → revise → approve.

## Phase 8 — Public Site Serving

**Goal:** fast, correct public rendering.

- [x] 8.0 (M) Enable Next.js Cache Components (`cacheComponents: true` in `next.config.ts`) and migrate the route-segment config it replaces. This is a prerequisite for 8.1, not part of it: `cacheTag` — and therefore the whole tag-based invalidation seam Phase 7 already built (`server/revalidate.ts`, `siteCacheTag`) — does nothing until the flag is on, so today those `updateTag` calls are verified-inert no-ops. Enabling it replaces `dynamic`, `revalidate`, and `fetchCache` route exports with the `use cache` directive plus `cacheLife`, which reaches two files outside this phase:
  - `src/app/templates/[templateId]/preview/page.tsx` — `export const revalidate = 3600` (Phase 4).
  - `src/app/preview/[token]/page.tsx` — `export const dynamic = "force-dynamic"` (Phase 6). CLAUDE.md records that export as load-bearing for FR-26's instant revocation. Under Cache Components uncached is the default, so the guarantee survives without it — but **re-verify FR-26 end to end and rewrite that decision note**, or it becomes a stale explanation of a line that no longer exists.
    Follow the official migration guide rather than training data; confirm `updateTag` still fires from the four Phase 7 admin/owner actions afterwards.

  **Outcome (larger than estimated — read before 8.1).** The two named files were the smallest part: the flag failed the build on **15 routes**, because any uncached `await` above a `<Suspense>` boundary is fatal under Cache Components. Resolved with `loading.tsx` boundaries in `(auth)` and `preview`, and by restructuring the `(app)`, `admin`, and `(marketing)` layouts so their guards/session reads stream inside the nav rather than blocking the layout (a `loading.tsx` does not cover its own layout's await). Every route is now `◐` Partial Prerender rather than fully dynamic, and the public homepage became static with the Edit button as its one session-aware island. `revalidateSite` → `updateTag` confirmed firing from a Server Action.

  **One guarantee regressed, knowingly:** a revoked preview link now returns **200 instead of 404** (streaming commits the status before `notFound()` runs). FR-26's substance and FR-27's noindex both verifiably hold; the full reasoning and the rejected alternatives are in CLAUDE.md, and `scripts/verify-8-0.ts` pins the behavior over real HTTP.

- [x] 8.1 (M) Public site route: a top-level `src/app/[site]/` segment serving `tedxplore.com/tedx{slug}` as a path on the main app (not a subdomain). The segment arrives whole (`tedxmcgillu`); use `parseTedxSegment` from `config/site.ts` to strip the prefix — a folder named `tedx[slug]` does not work, partial dynamic segments are unsupported. Then resolve slug → live snapshot → render (`mode: "public"`); static rendering + cache tags, revalidated by approve/unpublish/suspend; branded unavailable page for all non-live states.

  **Outcome.** `[site]/page.tsx` + `[site]/not-found.tsx`, `site-service.ts`, and `findLiveSiteBySlug`/`listLiveSlugs` in the snapshot repository. The caching contract deferred from 8.0 is settled: `getLiveSite` is a `use cache` function carrying `cacheLife("days")` + `cacheTag(siteCacheTag(slug))`, so Phase 7's four `updateTag` calls stop being inert. `generateStaticParams` is declared **for the status code, not the prerendering** — without it `params` is runtime data that must be read below a Suspense boundary, which would cost this route its 404 exactly as it cost `/preview/[token]`. `scripts/verify-8-1.ts` proves the seam end to end over HTTP: suspend without revalidating → still served (so the cache is real), then revalidate → dark on the very next request (FR-44). 12 checks.

- [x] 8.2 (S) SEO: per-site metadata, Open Graph/Twitter cards from event imagery, canonical URLs; sitemap of published sites; robots rules (exclude previews).

  **Outcome.** `generateMetadata` on `[site]`, `lib/site-metadata.ts` (pure description/card rules, 11 tests), `app/sitemap.ts`, `app/robots.ts`. The site title escapes the root layout's `%s · Tedxplore` template via `title.absolute` — a published site belongs to its organizers. The sitemap is tagged `SITEMAP_CACHE_TAG` and `revalidateSite` now updates it too, so approve/unpublish/suspend/restore refresh the sitemap through the call they already make. `scripts/verify-8-2.ts`, 31 checks, including fetching the generated OG image to confirm it resolves.

- [x] 8.3 (S) Snapshot schema-version upgrader scaffold (v1 passthrough) so old snapshots keep rendering after future `EventContent` changes.

  **Outcome.** `content/upgrade.ts` — `upgradeSnapshotContent` (throws) and `trySnapshotUpgrade` (returns a result), now the single way snapshot JSON becomes `EventContent`: both repository reads and the admin review screen go through it. Migrations are typed against plain JSON, never `EventContent`, so a v1→v2 migration cannot silently change meaning when v3 lands. Upgrading happens on every read and never rewrites a row (invariant 3). The chain-walker is exported and driven with synthetic versions in tests, because at v1 the real table is empty and the real loop never executes — a scaffold nobody has run is a scaffold that will not work on the day it is needed. A snapshot from a _newer_ deployment is refused rather than partially parsed (reachable during a rolling deploy). 13 tests.

**Exit:** published sites load fast globally with correct SEO and lifecycle behavior. — **met.** Lighthouse on `/tedxavelorne` against a production build: **94 performance / 100 accessibility / 100 best-practices / 100 SEO**, LCP 1.6s, CLS 0, TBT 0ms (desktop preset). For comparison, Phase 4 measured the same template at 90–91 with LCP 3.8s on the uncached preview route — the prerender plus the `use cache` entry is the difference. Lifecycle behavior verified over HTTP by `scripts/verify-8-1.ts` and `scripts/verify-8-2.ts`.

## Phase 9 — Reporting & Abuse Protection

- [x] 9.1 (S) Report UI on public sites: discreet footer link → form (category, explanation, optional email) with honeypot.

  **Outcome.** `lib/validation/report.ts` and `components/reports/report-dialog.tsx`, reached through a new **`reportSlot` on `TemplateRenderProps`**. That slot is the design decision: FR-45 wants the link in the template's own footer, but a report must name the event and `EventContent` deliberately carries no id or slug (C-1). Passing a React node — built by the route, positioned by the template — avoids both bad alternatives (a non-content field in `EventContent`, or handing the template something to query with). Same shape as 8.0's `editAction`. Only the public site supplies one; the homepage demo and both preview routes pass nothing and the footer renders without it. The schema is split into a transform-free `reportFormSchema` the browser binds to and a `reportSubmissionSchema` the server parses — partly a React Hook Form constraint, but mainly so the honeypot is **not** validated client-side, since telling a bot which field to leave alone turns the trap into a tutorial.

- [x] 9.2 (M) Report handler: validation, IP-hash rate limiting (DB fixed-window, 3/hour/site), Report persistence; expired rate-limit rows cleaned up (opportunistic on write + periodic Vercel cron sweep).

  **Outcome.** `RateLimitWindow` model (the first migration since Phase 1 — Phase 1's "full V1 schema" had `Report` but no counter table), `server/adapters/rate-limit.ts` behind a `RateLimiter` interface, `lib/client-ip.ts` (pure, unit-tested), `report-repository.ts`, `report-service.ts`, and `POST /api/reports`. IPs are HMAC'd with `BETTER_AUTH_SECRET` — a bare SHA-256 of an IPv4 address is enumerable in minutes. **Almost every outcome returns 202**, including a caught honeypot and a slug that is not a live site: a distinguishable response would teach a bot which field to leave alone, and would turn the endpoint into a slug oracle undoing FR-42's work on the read path. The rate limit is the only honest refusal. `scripts/verify-9-2.ts`, 20 checks, re-runnable. It **caught a real bug**: `max(0)` on the honeypot in the submission schema made a filled trap fail Zod with a 400 — exactly the tell three comments claimed to be avoiding, and it made the service's silent-discard branch unreachable.

- [x] 9.3 (S) Admin report inbox: list, detail with site link, resolve/dismiss, jump to suspend.

  **Outcome.** `report-admin-service.ts` (separate from the anonymous submission service — one reveals nothing, the other shows everything), inbox and detail routes under `/admin/reports`, `closeReportAction`, and a second badge on the admin nav. The list reports the _presence_ of a reporter email, never the address — that appears on the detail page alone, so it cannot be shoulder-surfed off a triage screen. Resolve vs. dismiss are kept distinct (they record opposite conclusions about the site, which is what tells a repeat offender from a repeatedly-reported innocent), and closing is a guarded `updateMany WHERE status='OPEN'` so two admins cannot overwrite each other. **Suspension is deliberately a link to the event page, not a button here** — taking a site offline should require seeing the whole event, not one stranger's paragraph. `scripts/verify-9-3.ts` drives the services directly, 15 checks (admin gate on every entry point, the two-admin race, address-withholding). **UI not yet eyeballed in a browser** — flagged like the 8.0 admin layout was; the service layer is fully covered.

- [x] 9.4 (S) Rate-limit adapter applied to preview-token guessing and auth-sensitive endpoints.

  **Outcome.** Two limiters, each on its natural store. **Preview guessing** uses our adapter with a new `peek` (check without consuming) so it counts *failures only*: a valid link resolves and returns before any write, so a legitimate viewer never spends the budget; a shaped-but-invalid guess consumes, and once over budget `peek` turns the guess away before the database lookup. A rate-limited guess is still an indistinguishable `NOT_FOUND` (contrast the report 429 — a guesser is owed no signal). **Auth** uses Better Auth's own limiter (chosen over wrapping the catch-all — it already knows every path), `storage: "database"` for Fluid Compute, `customRules` tightening sign-in (5/min), sign-up and reset (per hour). Needed the `RateLimit` model (second migration of the phase; Better Auth's table, hand-written to its documented shape). `scripts/verify-9-4.ts`, 9 checks over HTTP: guessing bounded, valid link consumes nothing, auth burst → 429 in the DB-backed table, and the two limiters use separate tables. **Phase 9 complete.**

**Exit:** visitor can report; admin can act; abuse is bounded. — **met.** Report flow verified end to end (9.1/9.2, 20+31 HTTP checks), admin inbox at the service layer (9.3, 15 checks), both rate limiters over HTTP (9.4, 9 checks). One item unverified in-browser: the 9.3 report inbox UI (needs an admin session).

## Phase 10 — Hardening & Launch

- [ ] 10.1 (M) E2E smoke suite (Playwright): homepage → Live Preview; homepage → Edit → login → create → edit → submit → approve → public view; report flow; preview link flow.
- [ ] 10.2 (S) Security pass: authorization audit on every action/handler, header hardening (CSP for public sites), URL/output sanitization review.
- [ ] 10.3 (S) Accessibility + performance final audit (app and public template).
  - **Carried over from Phase 8:** the root layout preloads Geist Sans and Geist Mono on public event sites, but Aurora sets its own `font-family` — so Geist Sans is on the critical path of every event site and never rendered. (Geist Mono _is_ used, by the countdown's `font-mono`.) Phase 4 flagged this for Phase 8's `[site]` route; Phase 8 did not do it. A root layout cannot preload per-route, so the options are `preload: false` or moving the Geist declarations into the app/marketing/auth/admin layouts and giving Aurora its own mono. Baseline to beat: 94 performance, LCP 1.6s.
- [ ] 10.4 (S) Operational polish: error monitoring hook points, structured logging in services, orphaned-media cleanup script.
- [ ] 10.5 (S) Homepage polish: finalize value-proposition copy and SEO metadata around the template grid built in 4.9; verify the Live Preview and Edit → login → create-event handoff end-to-end (do not rebuild — the homepage itself ships in Phase 4).
- [ ] 10.6 (S) Production env setup, domain, seed admin, launch checklist run.

**Exit:** production launch.

---

## Sequencing notes

- **Template before editor** (Phase 4 before 5) is deliberate: the editor's preview and the demo-content seed both depend on the template, and building the renderer first proves the `EventContent` contract before the editor writes to it.
- **Public homepage (4.9) sits at the end of Phase 4**, not earlier or in Phase 10: Live Preview needs the template renderer + `demoContent` to exist, and Edit needs both the auth redirect support (2.4) and the create-event flow (3.1) already built. Phase 4 is the earliest point all three dependencies are satisfied.
- Phases 4 and 5 are the bulk of the visible product; each of their tasks is independently reviewable.
- **8.0 exists because Phase 7 shipped the invalidation half of a cache whose other half doesn't exist yet.** That was deliberate — it meant the approve/suspend actions never had to be revisited — but it does mean the caching model is decided _in Phase 8_, and that decision retroactively confirms or invalidates `server/revalidate.ts`. Settle 8.0 before writing any of 8.1.
- Anything that touches the `EventContent` schema after Phase 1 must update the serializer, Zod schema, template, and (from Phase 8 on) the snapshot upgrader together — treated as one change.

## Definition of Done (every task)

- Typechecks, lints, unit tests for domain logic pass.
- Authorization enforced on any new mutation.
- Limits/validation come from central config.
- UI states covered: loading, empty, error, success.
- Responsive + keyboard accessible where UI is involved.
