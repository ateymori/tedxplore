# src/ — where things live

A map of the source tree and a rule for placing new code. For _why_ behind
specific decisions, see `CLAUDE.md`, `tech-stack.md`, and `project-scope.md`.

## Two UI worlds

The single biggest source of "wait, why is there a `components` folder in two
places?" is that there are two different kinds of UI, and they never mix:

| | **App chrome** — `src/components`, `src/lib` | **Public sites** — `src/templates/<name>` |
|---|---|---|
| Who sees it | You + organizers: dashboard, editor, admin, auth | The public: the generated TEDx event sites |
| Design | shadcn/ui + Tailwind, one consistent look | Bespoke per template, no shared look |
| Data | reads the session, calls services | **pure:** `(EventContent, mode, now) → JSX`, zero DB |
| Changes when | you improve the product | you add or tune a template |

`templates/aurora/components` and `src/components` share a _name_ but are
opposite in kind: one is one template's private render kit, the other is the
platform's shared UI. They never import each other's internals (the only
crossing point is `src/components/templates/`, `preview/`, and `admin/`, which
_mount_ a template inside app chrome via the registry).

## The backend stack (`src/server`)

```
repositories/  the ONLY code allowed to import Prisma (@/generated/prisma)
services/      domain logic; returns Result<T> unions; no framework imports
adapters/      Cloudinary / Resend / rate-limit behind interfaces
```

Routes and Server Actions stay thin: **authenticate → Zod-validate → call a
service**. Business rules live in services, never in routes or components.

## Top-level directories

| Folder | Responsibility |
|---|---|
| `app/` | Routes only (App Router). Thin — no business logic. |
| `components/` | App-chrome UI (shadcn-based), grouped by feature + `ui/` primitives. |
| `config/` | Every limit, reserved slug, route constant, env schema. Never hardcode these at a call site. |
| `content/` | The **`EventContent` contract** + serializer + completeness + snapshot upgrader. The spine: draft tables → contract → frozen snapshot. |
| `emails/` | React Email templates. |
| `generated/` | Prisma client. Generated on install, **gitignored — never edit or read it.** |
| `lib/` | Pure, framework-light helpers; `lib/validation/` holds shared Zod schemas. |
| `server/` | The backend stack above, plus `auth`, `auth-guards`, `logger`, `revalidate`. |
| `templates/` | Public-site renderers. `contract.ts` + `registry.ts` are shared; each `<name>/` is self-contained. See below. |
| `testing/` | Test _infrastructure_ (e.g. the `next/font` Vitest mock), **not** tests — tests are colocated as `*.test.ts` next to the code. |
| `proxy.ts` | Next.js proxy (was `middleware.ts`). Optimistic cookie check only — **not** an auth boundary. |

## Adding a template (Template 2, 3, …)

Each template is a fully self-contained folder. Adding one is **one directory +
one line in `registry.ts`** — nothing else in the app changes.

```
templates/
  contract.ts     ← shared: the (EventContent, mode, now) → JSX interface
  registry.ts     ← shared: the one list of which templates exist
  shared/         ← extract here ONLY when a 2nd template truly needs the
                    same behavior with no visual coupling. Empty until then.
  aurora/
    renderer.tsx      entry point
    sections/         one file per page section
    components/       this template's private render kit
    lib/              this template's pure helpers
    poster.tsx  demo-content.ts  fonts.ts  aurora.css
```

Three rules (an ESLint rule enforces #2):

1. A template owns everything about its look. Copy the folder shape for a new one.
2. **Templates never import each other.** Import your own files _relatively_
   (`./sections/hero`); the only absolute `@/templates/*` imports allowed are
   `contract` and `registry`.
3. Extract to `templates/shared/` **reactively, never speculatively** — only
   once a real second consumer exists. Premature sharing couples two designs.

## Where does new code go?

| I'm adding… | It goes in… |
|---|---|
| A page / route | `app/` (guard → validate → service) |
| Dashboard / editor / admin UI | `components/<feature>/` |
| A reusable shadcn primitive | `components/ui/` |
| Business logic / a decision | `server/services/` (returns a `Result`) |
| A Prisma query | `server/repositories/` (the only place `@prisma/client` is allowed) |
| A 3rd-party integration | `server/adapters/` |
| A limit, slug rule, constant | `config/` |
| A change to what a site _contains_ | `content/event-content.ts` + serializer + every template + upgrader — all four, one change |
| A pure helper (date, url, format) | `lib/` |
| A Zod schema | `lib/validation/` |
| How a **public site looks** | `templates/<name>/` and nowhere else |
| A new template | copy a template folder + one `registry.ts` entry |
