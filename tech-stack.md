# Tedxplore — Tech Stack & Architecture (Version 1)

## 1. Stack Summary

| Concern     | Choice                                                     | Notes                                                                    |
| ----------- | ---------------------------------------------------------- | ------------------------------------------------------------------------ |
| Framework   | **Next.js (App Router)**                                   | One app: marketing page, editor, admin, public sites                     |
| Language    | **TypeScript** (strict)                                    | End-to-end typing, no `any` escapes                                      |
| UI          | **React**, **Tailwind CSS**, **shadcn/ui**                 | shadcn for app/editor/admin chrome; public templates use bespoke styling |
| Animation   | **Motion** (Framer Motion's current package, `motion`)     | Scroll-driven and entrance animations on public templates                |
| Database    | **PostgreSQL on Neon**                                     | Vercel-integrated, serverless-friendly                                   |
| ORM         | **Prisma**                                                 | Schema-first, migrations, typed client                                   |
| Auth        | **Better Auth**                                            | Email/password + Google OAuth, email verification, password reset        |
| Email       | **Resend** + React Email                                   | Verification, reset, review-lifecycle notifications                      |
| Media       | **Cloudinary**                                             | Signed uploads, on-the-fly transforms, never serve originals             |
| Hosting     | **Vercel**                                                 | Preview deployments, edge network                                        |
| Validation  | **Zod**                                                    | Single source of truth shared by client forms and server handlers        |
| Forms       | **react-hook-form** + Zod resolver                         | Editor section forms                                                     |
| Testing     | **Vitest** (+ Testing Library), **Playwright** (smoke E2E) | Focus on domain logic, publishing workflow, slug/validation rules        |
| Lint/format | **ESLint** + **Prettier**                                  | Enforced in CI                                                           |

## 2. Architecture Overview

### 2.1 Layering

```
┌─────────────────────────────────────────────────────────┐
│ Presentation                                            │
│  • App UI (dashboard, editor, admin) — shadcn/Tailwind  │
│  • Template renderers (templates/*) — bespoke, animated │
├─────────────────────────────────────────────────────────┤
│ Application / Domain (src/server/services)              │
│  • event lifecycle, publishing workflow, moderation,    │
│    preview tokens, media, notifications                 │
│  • pure TypeScript; no Next.js or Prisma imports leak up│
├─────────────────────────────────────────────────────────┤
│ Data Access (src/server/repositories)                   │
│  • Prisma behind repository functions                   │
│  • only layer that imports @prisma/client               │
├─────────────────────────────────────────────────────────┤
│ Infrastructure adapters (src/server/adapters)           │
│  • Cloudinary, Resend, rate limiting                    │
└─────────────────────────────────────────────────────────┘
```

- Route Handlers and Server Actions are thin: authenticate → validate (Zod) → call a service → map result to response.
- Repositories keep Prisma isolated (NFR-9: provider swap without touching domain/UI).
- Services return typed results/errors (discriminated unions), not thrown strings.

### 2.2 Content vs. Presentation (the core separation)

**`EventContent`** is the heart of the system: a versioned, Zod-validated TypeScript type describing everything a template needs to render a site (hero, about, speakers, team, sponsors, venue, FAQs, contact, registration URL, …).

- The **editor** writes normalized draft data (relational tables).
- A **serializer** (`draftToEventContent`) converts an event's draft tables into `EventContent`.
- **Snapshots** are `EventContent` JSON frozen at submission time, stored with a `schemaVersion` for future migrations.
- **Templates** are pure consumers: `render(content: EventContent) → React tree`. They never query the database and never know about drafts vs snapshots.

```
Draft tables ──serialize──▶ EventContent ──▶ Template renderer
                    │                              ▲
                    └──▶ Snapshot (frozen JSON) ───┘
     (preview path)          (public path)
```

This yields, for free: identical rendering for preview/review/public (same renderer, different content source), immutable audit trail, and Template 2 as "just another renderer."

### 2.3 Template registry

```ts
// src/templates/registry.ts
interface TemplateDefinition {
  id: string; // "aurora" (V1 template)
  name: string;
  description: string;
  thumbnail: string;
  Renderer: ComponentType<{ content: EventContent; mode: RenderMode }>;
  demoContent: EventContent; // placeholder content seeded into new events
}
```

- `Event.templateId` is a plain string column — no template-specific fields anywhere in the schema (C-2).
- The future template gallery reads this registry; adding Template 2 = adding one directory + one registry entry.
- `demoContent` doubles as the seed for new drafts and the live demo/"preview" site.

### 2.4 Routing map

```
/                         Marketing/landing (V1: simple, links to sign-up)
/login /signup /verify-email /reset-password
/dashboard                Event list
/dashboard/events/[id]/…  Editor (sectioned), settings, publish status
/admin/…                  Review queue, reports, events (ADMIN only)
/preview/[token]          Token-based draft preview (noindex)
/[site]                   Public published site: /tedx{slug}  ← last in precedence
/api/…                    Route handlers (auth, autosave, uploads, reports)
```

**Every event site is a path on the one application at `tedxplore.com`** — never a subdomain, never a separate domain. `tedxplore.com/tedxmcgillu` is a route of this Next.js app, served from the same deployment and codebase as the dashboard and admin area. (Per-event vanity domains are explicitly out of scope for V1.)

The `tedx` prefix and the slug occupy a _single_ URL segment, which the App Router cannot express as a folder: **a directory named `tedx[slug]` matches nothing** — partial dynamic segments are unsupported, a dynamic segment must occupy its entire segment. This was verified empirically, not assumed.

The public route is therefore a top-level `[site]` segment that receives the whole segment (`tedxmcgillu`) and strips the prefix itself, via `parseTedxSegment` in `src/config/site.ts` — the inverse of `tedxSitePath`, kept beside it so the two directions can't drift. A segment that doesn't start with `tedx`, or is exactly `tedx`, is a 404.

Next.js gives static routes precedence over dynamic ones, so `/dashboard`, `/admin`, and `/api/...` always win over `[site]` — the catch-all cannot shadow the application. This also means an event URL can only collide with an app route that itself begins with `tedx`; the reserved-slug blocklist's real work is preventing brand confusion (`/tedxplore`) and offensive URLs, not route collisions.

### 2.5 Data model (Prisma, summary)

```
User            id, email, name, image, role (USER|ADMIN), auth fields (Better Auth tables)
Event           id, ownerId, slug (case-preserving), slugLower (unique), displayName, templateId,
                publicationStatus (NEVER_PUBLISHED|PUBLISHED|UNPUBLISHED|SUSPENDED),
                liveSnapshotId?, tedEventUrl, licenseHolderName, authorizationConfirmedAt,
                deletedAt?, createdAt, updatedAt
                + draft content columns (tagline, about, eventDate, timezone, venue*, contactEmail,
                  registrationUrl, socialLinks JSON, hero/venue image refs)
Speaker         id, eventId, name, title, bio, photo (MediaAsset ref), talkTitle, links JSON, sortOrder
TeamMember      id, eventId, name, role, photo, links JSON, sortOrder
Sponsor         id, eventId, name, logo, websiteUrl, tier enum, sortOrder
Faq             id, eventId, question, answer, sortOrder
MediaAsset      id, eventId, uploaderId, cloudinaryPublicId, kind, width, height, bytes, createdAt
PublishRequest  id, eventId, snapshotId, status (PENDING|APPROVED|REJECTED|CANCELED),
                submittedAt, reviewedAt?, reviewerId?, rejectionReason?
Snapshot        id, eventId, schemaVersion, content JSON (EventContent), createdAt   [immutable]
PreviewToken    id, eventId, token (unique), createdAt, revokedAt?
Report          id, eventId, category enum, explanation, reporterEmail?, reporterIpHash,
                status (OPEN|RESOLVED|DISMISSED), createdAt, resolvedAt?, resolverId?
```

Future-proofing: `ownerId` is the only ownership link (an `organizationId` can be added alongside later); `templateId` is data-driven; nothing couples the schema to the single-template V1.

### 2.6 Publishing workflow (state)

```
draft edits (always allowed)
   │ submit (completeness check)
   ▼
PublishRequest PENDING ── cancel ──▶ CANCELED
   │ admin
   ├─ approve ─▶ APPROVED: event.liveSnapshotId = request.snapshotId,
   │             publicationStatus = PUBLISHED
   └─ reject ──▶ REJECTED (reason required)

Owner:  PUBLISHED ⇄ UNPUBLISHED (no approval)
Admin:  PUBLISHED → SUSPENDED → (restore) → PUBLISHED
```

Approval is a single transaction (update request + event pointer) — the live site swap is atomic.

## 3. Key Decisions & Rationale

1. **Snapshots as JSON, drafts as relational.** Drafts need granular editing, validation, and per-row limits → relational. Published output needs immutability and template-independence → frozen JSON validated against a versioned `EventContent` schema. Guarantees: snapshots are never mutated after creation; every submission creates a new snapshot recording its `schemaVersion`; the approved snapshot stays live while newer changes are in draft or pending review; all snapshots are retained for audit and possible restoration. Migrating old snapshots forward happens in code (schema-version upgraders), not SQL. Republishing an unchanged, previously approved snapshot needs no new review; changed content always does.
2. **Server Actions for editor mutations, Route Handlers for `api/` surface** (auth callbacks, upload signing, report submission, preview). Server Actions give typed, colocated mutations for the authenticated editor; public/unauthenticated endpoints stay as route handlers with explicit rate limiting.
3. **Autosave design:** per-section debounced writes (~1.5 s idle) via Server Actions; optimistic UI with status indicator; versioned `updatedAt` check to detect conflicting concurrent sessions (last-write-wins with warning in V1).
4. **Cloudinary signed uploads:** client uploads directly to Cloudinary using short-lived signatures from our server (keeps 10 MB files off our functions); server records the resulting `MediaAsset` and validates format/size from Cloudinary's response.
5. **Rate limiting without extra infra:** DB-backed fixed-window counters (Postgres) for report submission and preview-token attempts, behind an adapter interface (`RateLimiter`) so the implementation can be swapped for Upstash Redis or another provider without touching application logic. Expired window rows carry an indexed `expiresAt` and are cleaned up efficiently — opportunistically on write plus a periodic sweep (Vercel cron).
6. **Preview tokens:** 32 bytes from `crypto.randomBytes`, base64url, stored as-is (they gate read-only draft views, not account access); single active token per event; revocation = row update. `X-Robots-Tag: noindex` on all preview responses.
7. **Rendering strategy:** public sites are statically rendered and cached (ISR / cache tags), revalidated on approve/suspend/unpublish. Editor and admin are dynamic. This gives premium load performance on the pages that matter most.
8. **Better Auth over NextAuth:** first-class email/password + verification + reset flows out of the box, Prisma adapter, and clean session APIs — matches our exact requirements with less custom code.
9. **shadcn/ui only for the application chrome.** Public templates are hand-crafted (typography, motion, layout) to avoid the generic look — they share Tailwind but not the component kit.
10. **Centralized config module** (`src/config/limits.ts`, `src/config/reserved-slugs.ts`): every limit (16 speakers, 10 MB, …) and the slug blocklist defined once, imported by Zod schemas, UI copy, and server checks alike.
11. **Prisma 7's connection model** (implemented in Phase 0): `schema.prisma` no longer holds a datasource URL — that lives in `prisma.config.ts`, read from `DIRECT_URL` (unpooled, used by CLI migrate commands). The runtime `PrismaClient` (`src/server/repositories/prisma.ts`) instead takes an explicit driver adapter (`@prisma/adapter-pg`) constructed from the pooled `DATABASE_URL`. This replaces the older single-`datasource-url`-with-`directUrl`-field pattern implied elsewhere in this doc; the pooled-vs-direct split still holds, just wired through two different files.

## 4. Environment & Services

```
DATABASE_URL                  Neon (pooled), + DIRECT_URL for migrations
BETTER_AUTH_SECRET / URL
GOOGLE_CLIENT_ID / SECRET
CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET
RESEND_API_KEY
EMAIL_FROM                    e.g. no-reply@tedxplore.com
NEXT_PUBLIC_APP_URL
```

- Local dev: `.env` + a Neon branch database (or a local Postgres instance as fallback — currently in use, see README).
- CI: lint, typecheck, unit tests, build on every push; Playwright smoke on main.
- Vercel: preview deployments per branch; production on main.

## 5. Project Structure (planned)

```
src/
  app/                      # routes only (thin)
    (marketing)/
    (auth)/
    (app)/dashboard/...
    admin/...
    preview/[token]/
    [site]/                 # public tedx{slug} renderer
    api/...
  components/               # shared app UI (shadcn-based)
  templates/
    registry.ts
    aurora/                 # V1 template: sections/, demo-content.ts, index.tsx
  content/
    event-content.ts        # EventContent Zod schema + types (versioned)
    serializer.ts           # draft → EventContent
  server/
    services/               # domain logic
    repositories/           # Prisma access
    adapters/               # cloudinary, resend, rate-limit
    auth.ts                 # Better Auth instance
    auth-guards.ts          # requireUser / requireAdmin / Result variants
  config/                   # limits, reserved slugs, site constants
  emails/                   # React Email templates
  proxy.ts                  # Next 16's renamed `middleware` — optimistic auth redirects only
prisma/
  schema.prisma, migrations/, seed.ts
scripts/
  grant-admin.ts            # the only way to set UserRole.ADMIN
```
