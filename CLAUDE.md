# Tedxplore — Project Guide

Tedxplore is a specialized **no-code platform that generates premium TEDx-style event websites from structured event data**. It is NOT a website builder: users never touch layout, HTML, CSS, or design — they fill in structured content (speakers, sponsors, venue, FAQs, …) and the platform renders a professionally designed, animated, responsive single-page site.

Product philosophy: _"A premium event website generated automatically from structured event data."_

## Core documents (read before making decisions)

- **`project-scope.md`** — functional/non-functional requirements (FR-x, NFR-x), user roles, flows, business rules (BR-x), out-of-scope list, roadmap, assumptions. The authority on _what_ we build.
- **`tech-stack.md`** — stack choices, architecture layering, `EventContent` contract, template registry, data model, publishing state machine, key decisions with rationale. The authority on _how_.
- **`implementation-plan.md`** — 10 phases of small tasks with exit criteria. The authority on _order_. Check tasks off (`[x]`) as they are completed.
- `prompt.txt` — the original product brief (historical reference; the three docs above supersede it where they differ).

## Current status

- Planning docs approved by Mohammad (the product owner and sole admin).
- **Phase 0 in progress:** 0.1–0.4 and 0.6 done (Next.js 16 + TS strict + Tailwind + shadcn/ui scaffolded; Prisma 7 wired to a local Postgres instance with a working migration pipeline; centralized config; base layout/error/404/health route). Local dev uses a `tedxplore` database on the Postgres instance already running on Mohammad's machine (`postgres:postgres@localhost:5432`), not Docker. 0.5's CI workflow file is written and locally verified; **Vercel project connection and the real Neon database are deferred until Mohammad runs `vercel login`**. Git is initialized locally; no GitHub remote yet.
- **Phase 1 complete:** full V1 Prisma schema + single init migration (verified to replay from empty); `EventContent` Zod contract (`src/content/event-content.ts`, `schemaVersion: 1`); serializer + BR-13 section visibility (`src/content/serializer.ts`); BR-14 completeness gate (`src/content/completeness.ts`); slug/display-name/URL validators (`src/lib/validation/`); repository skeleton + `Result`/`DomainError` types (`src/server/`); idempotent seed (`prisma/seed.ts`, run with `pnpm exec prisma db seed`). 78 unit tests.
- **Phase 2 complete:** Better Auth 1.6 (email/password with mandatory verification, optional Google OAuth, `role` via `additionalFields`); Resend adapter with a console fallback + React Email templates; auth UI (`/login`, `/signup`, `/verify-email`, `/forgot-password`, `/reset-password`); `src/proxy.ts` + `src/server/auth-guards.ts` with `returnTo` support. 113 unit tests. Every flow verified against the local database — signup → verify → auto sign-in, unverified sign-in refused, reset → session revocation → reused-token rejection, admin gate both ways.
- **Phase 3 complete:** template registry pulled forward from Phase 4 (`src/templates/`) with the `aurora` demo seed; create-event flow (`/dashboard/events/new`) with live URL preview + debounced availability check; dashboard event cards with publication/review badges and empty state; event settings (`/dashboard/events/[eventId]/settings`) with display name, licensing info, and slug editing under the BR-5 lock; delete flow with mode-aware confirmation. 168 unit tests. Every flow verified against the local database via the service layer — demo seeding, duplicate/reserved slug rejection, non-owner `NOT_FOUND`, slug lock after publish, and both deletion modes with their slug-release behavior.
- Update this section as phases complete.

## Routing model (settled — don't re-derive)

- **One app, one domain.** Every event site is a _path_ on `tedxplore.com`: `tedxplore.com/tedx{slug}` (e.g. `/tedxmcgillu`). Not a subdomain, not a separate domain, not a separate deployment. Per-event custom domains are out of scope for V1.
- **The route is `src/app/[site]/`, not `src/app/tedx[slug]/`.** The App Router does not support partial dynamic segments — a folder named `tedx[slug]` matches nothing (verified empirically, returns 404). `[site]` receives the entire segment (`tedxmcgillu`) and strips the prefix via `parseTedxSegment` from `src/config/site.ts`.
- Build URLs with `tedxSitePath`/`tedxSiteUrl`, parse them with `parseTedxSegment` — never hardcode the `tedx` prefix at a call site.
- Static routes beat dynamic ones, so `/dashboard`, `/admin`, `/api/...` always take precedence over `[site]`. An event URL can therefore only collide with an app route that itself starts with `tedx`; the reserved-slug blocklist mainly prevents brand confusion (`/tedxplore`) and offensive URLs.

## Phase 1 decisions worth knowing

- **Slug minimum length is 2, not 3** (BR-1, `SLUG_MIN_LENGTH`) — changed during Phase 1.
- **`EventContent` uses `null`, never `undefined`, for absent values.** Snapshots round-trip through `JSON.stringify`, which drops `undefined` keys — an optional field would change shape between the preview and published paths.
- **BR-9 (one pending publish request per event) is enforced by the database** via `PublishRequest.pendingEventId`: it holds `eventId` while PENDING and NULL in every terminal state, so a plain unique index acts as a partial index. A raw `WHERE status = 'PENDING'` index would register as permanent Prisma schema drift. Only `publish-request-repository.ts` may write `status`, so the two can't diverge.
- **`EventContent` images carry no `alt` field.** Every V1 image slot has adjacent content that describes it better (speaker/sponsor/venue name); the hero background is decorative (`alt=""`). Templates derive alt text contextually.
- **Auth tables are hand-written to match Better Auth's core schema.** Phase 2 should run Better Auth's CLI generate and reconcile before building on them. `role` is a Prisma enum surfaced through Better Auth's `additionalFields`.

## Phase 2 decisions worth knowing

- **Next.js 16 renamed `middleware.ts` to `proxy.ts`** (exporting `proxy`, not `middleware`). The file is `src/proxy.ts`; the `edge` runtime is not supported there.
- **The proxy is not an authorization boundary.** It does an optimistic _cookie-presence_ check (`getSessionCookie`) and never validates a session. The real gate is `src/server/auth-guards.ts`, which every protected page, action, and handler must call. Never treat a path as protected merely because it appears in the proxy matcher.
- **Guards come in two flavours by caller:** `requireUser`/`requireAdmin` redirect (pages/layouts), `getAuthenticatedUser`/`getAdminUser` return a `Result` (Server Actions/route handlers, which must render an error rather than redirect mid-mutation). `getCurrentUser` is wrapped in React `cache`, so calling a guard repeatedly in one request is free.
- **Email verification is enforced by Better Auth, not by our code.** `requireEmailVerification: true` means no session is ever issued to an unverified account, so holding a session _is_ proof of verification (FR-3) — do not re-check `emailVerified` in guards.
- **`role` is `input: false`.** It cannot be set through sign-up or any client call. The only path to ADMIN is `pnpm exec tsx scripts/grant-admin.ts <email>` (`--revoke` to reverse). There is intentionally no admin-granting UI.
- **`returnTo` is attacker-controlled.** Always pass it through `sanitizeReturnTo`/`resolveReturnTo` (`src/lib/return-to.ts`) before navigating — an open redirect on a login page is a phishing primitive. Sanitize server-side in the page, then hand the clean value to client components.
- **Google OAuth and Resend degrade instead of failing.** Missing Google credentials hide the button and skip provider registration; a missing `RESEND_API_KEY` prints emails to the server console (which is how the flows were tested locally). `assertProductionIntegrations()` still refuses these modes at request time in production.
- **`src/config/env.ts` validates server env at module load.** CI's build step therefore supplies a placeholder `BETTER_AUTH_SECRET` — `next build` executes module scope without runtime secrets.
- **The hand-written auth tables were reconciled against `@better-auth/cli generate`** and match field-for-field; the sole deliberate deviation is `role` as the `UserRole` Prisma enum where the generator emits `String`. No migration was needed. (The CLI cannot load a config importing `server-only`; reconcile via a temporary standalone config file.)

- **Forms use React Hook Form + `zodResolver`** against the shared schemas in `src/lib/validation/`. API failures go to `form.setError("root", …)` and render in an `Alert`; field errors render in `FieldError`. Don't hand-roll `FormData` parsing.
- **`pnpm.overrides` pins a single `zod`.** `globals.css` imports `shadcn/tailwind.css`, so the `shadcn` package is a real build dependency — and it depends on zod 3.25, whose bundled `zod/v4` preview is a _different type identity_ from our zod 4. Without the override, `@hookform/resolvers` resolves the wrong copy and every `zodResolver` call fails to typecheck. Don't remove `shadcn` (the build needs it) and don't remove the override.
- **`SiteNav` takes `user` as a prop** rather than reading the session itself, so each layout controls where the session comes from and the signed-in state is in the first HTML. It is deliberately absent from `[site]` — public event sites render the organizer's template chrome, not ours.

## Phase 3 decisions worth knowing

- **The template registry shipped in Phase 3, not Phase 4.** FR-10 requires new events to be seeded with demo content, which needs a registry — so `src/templates/{registry,types}.ts` and `aurora/demo-content.ts` exist now. `TemplateDefinition` has no `Renderer` field yet (4.1 adds it); a placeholder component or an optional field would have been worse than its absence.
- **The demo seed is authored in _draft_ shape; `demoContent` is derived from it** by running the real serializer (`demoContent(template, now)` in `templates/types.ts`). It has two jobs — seed new drafts, render the homepage Live Preview — and maintaining an `EventContent` fixture alongside the seed would be two sources of truth. `demoSeed` is a _function of `now`_ because a hardcoded event date would eventually render the post-event state (FR-39) on brand-new drafts.
- **`prisma/seed.ts` seeds from the registry**, so local data matches what a real new event looks like.
- **Demo content deliberately references no images.** Cloudinary is Phase 5, and an image-free demo exercises the FR-38 hero fallback from day one.
- **`canManageEvent` lives in `src/server/services/authorization.ts`, not `auth-guards.ts`** (which re-exports it). It is a pure predicate; keeping it out of the guards module means services can apply it without dragging in `next/navigation` and `server-only` — which is also what makes the service layer runnable from a plain Node script for database verification.
- **A non-owner gets `NOT_FOUND`, never `FORBIDDEN`.** Confirming an event id exists is itself information. `loadManageable` in `event-service.ts` collapses the two cases; pages must not undo that by rendering a distinguishable error.
- **Server Actions return `Result`, never redirect.** A redirect thrown mid-mutation discards the field errors the form needs to render. Success navigation is the client's job (`router.push`). `src/lib/form-errors.ts` maps every `DomainError` to a field + message with an exhaustive switch — adding an error variant fails to compile until it has user-facing copy.
- **BR-5's slug lock is enforced twice, deliberately:** the service checks the state for a friendly error, and `updateEventSlug`'s write is scoped to `NEVER_PUBLISHED` so an event published between check and write still can't change its URL. Same for BR-3 — the pre-check is UX, the unique index is enforcement (`P2002` maps back to `SLUG_TAKEN` via `isUniqueConstraintError`).
- **Deletion mode is a shared pure rule** (`server/services/event-rules.ts`), imported by both the service and the confirmation dialog, so the dialog can't promise one outcome while the server does the other. Hard delete releases the slug; soft delete keeps it reserved forever.
- **The `shadcn` CLI can't run from the local install** — our zod-4 override breaks it (`s.deepPartial is not a function`). Use `pnpm dlx shadcn@latest add …`, which resolves its own zod 3, and decline the overwrite prompts for existing components.
- **Use `useWatch`, not `form.watch()`**, and never mutate a ref from a `register` callback — the React Compiler lint rules reject both. Where the create form needed "has the user taken over the display name?", it derives the answer from the values rather than remembering it.

## Architectural invariants (never violate)

1. **Content vs. presentation separation.** The DB schema contains zero template-specific fields. Templates are pure renderers: `(content: EventContent, mode) → React tree`; they never touch the database. The editor is template-independent.
2. **`EventContent` is the contract** (`src/content/event-content.ts`, Zod, versioned via `schemaVersion`). Drafts (relational tables) serialize into it; snapshots freeze it as JSON; templates consume only it. Any change to it must update the Zod schema, serializer, template, and snapshot upgrader together, in one change.
3. **Snapshots are immutable.** Every submission creates a new snapshot; snapshots are never mutated; all are retained for audit/restoration. The public site renders **only** the latest approved snapshot — never draft tables.
4. **Layering:** routes/actions are thin (auth → Zod validate → service). Services are pure TS domain logic returning discriminated-union results. Only `src/server/repositories/` imports `@prisma/client`. External services (Cloudinary, Resend, rate limiting) live behind adapters in `src/server/adapters/`.
5. **Centralized config:** every limit, the reserved-slug blocklist, and site constants live in `src/config/` — never hardcode them at call sites.
6. **Authorization on every mutation** (owner-or-admin), server-side validation always; client validation is UX only.

## Key product rules (quick reference — details in project-scope.md)

- **Slug, Display Name, and Theme are three independent fields (BR-1..BR-5d) — never conflate them:**
  - _Slug_: lowercase `a–z` only (no uppercase/digits/hyphens/spaces), 2–50 chars, globally unique, used exclusively to build the URL (`/tedx{slug}`), locked after first publication.
  - _Display Name_: any-case letters + spaces + accents + hyphens (no digits); NOT unique; freely editable anytime, even after publication; pre-filled at creation with a `TEDx`+capitalized-slug suggestion the user typically overwrites (e.g., `TEDxMcGill University`); shown in nav/page-title/Hero; the **only** field that's always required and can never be saved blank.
  - _Theme_: optional, ≤100 chars, short tagline/theme phrase shown as the Hero subtitle.
- **Publishing:** draft/snapshot model. Submit → completeness check → new snapshot + PublishRequest (one pending max, cancelable). Approve = atomic live-snapshot swap. Reject requires a reason. Owner may unpublish/republish freely; republishing an _unchanged_ approved snapshot needs no review. Admin may suspend/restore. Full-site review on every resubmission (no diffs in V1).
- **Sections:** Hero, About TED, About TEDx, disclaimer, footer always render. Only the Hero has blank-able organizer content — Theme and hero/background imagery — each falling back to a platform-provided default so the Hero never looks broken; About TED/About TEDx/disclaimer are static platform copy with no organizer-editable portion at all. Every other section (About, Venue, Speakers, Sponsors, Team, FAQ, Contact) auto-hides when empty, with **no** fallback content (sponsor tiers individually auto-hide too). **No Schedule section in V1** (deferred; will be an additive `EventContent` version bump).
- **Countdown** switches to "This event has taken place." after the event date.
- **Public homepage:** browsable without login; template cards show _Live Preview_ (opens `demoContent` through the real template, new tab, no auth) and _Edit_ (unauthenticated → login/signup → returns to event creation for that template). V1 shows one card (`aurora`), grid built to scale to future templates.
- **Limits (config/limits.ts):** 16 speakers, 30 team members, 30 sponsors, 30 FAQs, 10 MB/image.
- **Sponsor tiers:** PARTNER, PLATINUM, GOLD, SILVER, BRONZE, COMMUNITY.
- **Deletion:** confirmation required; soft delete if ever published, hard delete otherwise.
- **Preview links:** single active 256-bit token per event, revocable/regenerable, read-only, `noindex`.
- **Reports:** public form (category, explanation, optional email), honeypot + DB rate limit 3/IP/hour/site.
- **Emails (Resend):** verification, password reset, submission received, approved, rejected (with reason), suspended.

## Stack (details in tech-stack.md)

Next.js App Router + TypeScript (strict) + Tailwind + shadcn/ui (app chrome only — public templates are bespoke) + Motion (`motion` package). Prisma + Neon Postgres. Better Auth (email/password + verification + reset, Google OAuth, `role` on User). Cloudinary (signed direct uploads; always serve transformed renditions). Resend + React Email. Zod everywhere. Vitest + Playwright. Vercel.

V1 template id: **`aurora`** (`src/templates/aurora/`), registered in `src/templates/registry.ts` with `demoContent` that seeds every new event and powers the homepage's Live Preview.

## Conventions

- TypeScript strict; no `any` escapes; domain errors as discriminated unions, not thrown strings.
- Zod schemas are the single source of validation truth, shared client and server.
- Editor mutations = Server Actions; public/unauthenticated endpoints = Route Handlers with rate limiting.
- Autosave: debounced (~1.5 s) per-section, status indicator (`Saving…/Saved/Save failed/Unsaved changes`) + manual "Save now"; last-write-wins with a warning on concurrent sessions.
- External user links: validate http/https, render with `target="_blank" rel="noopener noreferrer"`.
- Public sites: statically rendered with cache tags, revalidated on approve/unpublish/suspend; Lighthouse ≥ 90 target; `prefers-reduced-motion` respected.
- Definition of done for every task: typecheck + lint + relevant unit tests pass; authz on new mutations; limits from central config; loading/empty/error/success UI states; responsive + keyboard accessible.

## Out of scope for V1 (do not build)

Multiple templates, custom domains, i18n, analytics, AI, blogging, ticketing integrations, marketplace, public discovery, drag-and-drop editing, organizations/collaborators, schedule section, recorded talks, diff-based review. Architecture must keep these cheap to add later (e.g., `templateId` string column, `ownerId` as sole ownership link).

## Working agreements

- **Use the Context7 MCP server for up-to-date library/framework documentation** (Next.js, Prisma, Better Auth, Tailwind, shadcn/ui, Motion, Cloudinary, Resend, Zod, …) whenever writing or debugging code that depends on their APIs — training knowledge may be stale; prefer Context7 over guessing or web search.
- This project runs **Next.js 16**, which has real breaking changes vs. most training data (e.g., `error.tsx` receives `unstable_retry` instead of `reset`). See `AGENTS.md` and `node_modules/next/dist/docs/` before writing Next.js-specific code. Same caution applies to **Prisma 7**: no datasource `url` in `schema.prisma`, connection config lives in `prisma.config.ts`, and `PrismaClient` requires an explicit driver adapter (`@prisma/adapter-pg`) — see `src/server/repositories/prisma.ts`.
- Challenge assumptions when a better architectural/product option exists — explain before implementing.
- Ask before starting a new phase; within an approved phase, proceed task by task without re-asking.
- Keep the three core docs and this file up to date when decisions change; docs are the source of truth, not chat history.
