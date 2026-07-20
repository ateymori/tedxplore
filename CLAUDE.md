# Tedxplore — Project Guide

Tedxplore is a specialized **no-code platform that generates premium TEDx-style event websites from structured event data**. It is NOT a website builder: users never touch layout, HTML, CSS, or design — they fill in structured content (speakers, sponsors, venue, FAQs, …) and the platform renders a professionally designed, animated, responsive single-page site.

Product philosophy: *"A premium event website generated automatically from structured event data."*

## Core documents (read before making decisions)

- **`project-scope.md`** — functional/non-functional requirements (FR-x, NFR-x), user roles, flows, business rules (BR-x), out-of-scope list, roadmap, assumptions. The authority on *what* we build.
- **`tech-stack.md`** — stack choices, architecture layering, `EventContent` contract, template registry, data model, publishing state machine, key decisions with rationale. The authority on *how*.
- **`implementation-plan.md`** — 10 phases of small tasks with exit criteria. The authority on *order*. Check tasks off (`[x]`) as they are completed.
- `prompt.txt` — the original product brief (historical reference; the three docs above supersede it where they differ).

## Current status

- Planning docs approved by Mohammad (the product owner and sole admin).
- **Phase 0 in progress:** 0.1–0.4 and 0.6 done (Next.js 16 + TS strict + Tailwind + shadcn/ui scaffolded; Prisma 7 wired to a local Postgres instance with a working migration pipeline; centralized config; base layout/error/404/health route). Local dev uses a `tedxplore` database on the Postgres instance already running on Mohammad's machine (`postgres:postgres@localhost:5432`), not Docker. 0.5's CI workflow file is written and locally verified; **Vercel project connection and the real Neon database are deferred until Mohammad runs `vercel login`**. Git is initialized locally; no GitHub remote yet.
- Update this section as phases complete.

## Architectural invariants (never violate)

1. **Content vs. presentation separation.** The DB schema contains zero template-specific fields. Templates are pure renderers: `(content: EventContent, mode) → React tree`; they never touch the database. The editor is template-independent.
2. **`EventContent` is the contract** (`src/content/event-content.ts`, Zod, versioned via `schemaVersion`). Drafts (relational tables) serialize into it; snapshots freeze it as JSON; templates consume only it. Any change to it must update the Zod schema, serializer, template, and snapshot upgrader together, in one change.
3. **Snapshots are immutable.** Every submission creates a new snapshot; snapshots are never mutated; all are retained for audit/restoration. The public site renders **only** the latest approved snapshot — never draft tables.
4. **Layering:** routes/actions are thin (auth → Zod validate → service). Services are pure TS domain logic returning discriminated-union results. Only `src/server/repositories/` imports `@prisma/client`. External services (Cloudinary, Resend, rate limiting) live behind adapters in `src/server/adapters/`.
5. **Centralized config:** every limit, the reserved-slug blocklist, and site constants live in `src/config/` — never hardcode them at call sites.
6. **Authorization on every mutation** (owner-or-admin), server-side validation always; client validation is UX only.

## Key product rules (quick reference — details in project-scope.md)

- **Slug, Display Name, and Theme are three independent fields (BR-1..BR-5d) — never conflate them:**
  - *Slug*: lowercase `a–z` only (no uppercase/digits/hyphens/spaces), 3–50 chars, globally unique, used exclusively to build the URL (`/tedx{slug}`), locked after first publication.
  - *Display Name*: any-case letters + spaces + accents + hyphens (no digits); NOT unique; freely editable anytime, even after publication; pre-filled at creation with a `TEDx`+capitalized-slug suggestion the user typically overwrites (e.g., `TEDxMcGill University`); shown in nav/page-title/Hero; the **only** field that's always required and can never be saved blank.
  - *Theme*: optional, ≤100 chars, short tagline/theme phrase shown as the Hero subtitle.
- **Publishing:** draft/snapshot model. Submit → completeness check → new snapshot + PublishRequest (one pending max, cancelable). Approve = atomic live-snapshot swap. Reject requires a reason. Owner may unpublish/republish freely; republishing an *unchanged* approved snapshot needs no review. Admin may suspend/restore. Full-site review on every resubmission (no diffs in V1).
- **Sections:** Hero, About TED, About TEDx, disclaimer, footer always render. Only the Hero has blank-able organizer content — Theme and hero/background imagery — each falling back to a platform-provided default so the Hero never looks broken; About TED/About TEDx/disclaimer are static platform copy with no organizer-editable portion at all. Every other section (About, Venue, Speakers, Sponsors, Team, FAQ, Contact) auto-hides when empty, with **no** fallback content (sponsor tiers individually auto-hide too). **No Schedule section in V1** (deferred; will be an additive `EventContent` version bump).
- **Countdown** switches to "This event has taken place." after the event date.
- **Public homepage:** browsable without login; template cards show *Live Preview* (opens `demoContent` through the real template, new tab, no auth) and *Edit* (unauthenticated → login/signup → returns to event creation for that template). V1 shows one card (`aurora`), grid built to scale to future templates.
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
