# Tedxplore — Project Scope (Version 1)

> A premium event website generated automatically from structured event data — **not** a drag-and-drop website builder.

Tedxplore lets TEDx-style event teams create polished, production-ready event websites by filling in structured content (speakers, schedule, venue, sponsors, …). The design, layout, animations, and responsiveness are already built. Users can never break the design.

---

## 1. Functional Requirements

### 1.1 Authentication & Accounts
- FR-1: Users can register with email + password.
- FR-2: Users can sign in with Google OAuth.
- FR-3: Email/password accounts require email verification before creating events.
- FR-4: Users can reset a forgotten password via email.
- FR-5: Sessions persist across visits; users can sign out.
- FR-6: Every user has a role: `USER` (default) or `ADMIN`.

### 1.2 Event Creation
- FR-7: An authenticated, verified user can create one or more events.
- FR-8: Event creation collects, at minimum:
  - Event slug — URL-only identifier (see Business Rules: Slug)
  - Display name — the human-readable event name shown throughout the UI (see Business Rules: Display Name). The form pre-fills a simple suggested default (`TEDx` + capitalized slug), which the user is expected to overwrite with proper casing/spacing (e.g., "TEDxMcGill University")
  - Authorization affirmation checkbox (required)
  - Official TED event page URL
  - TEDx license holder / lead organizer name
- FR-9: The slug is reserved immediately upon creation (uniqueness enforced at the database level).
- FR-10: A newly created event starts as a draft, pre-populated with the template's demo/placeholder content so the user always sees a complete, beautiful site.

### 1.3 Event Dashboard
- FR-11: Users see a dashboard listing all their events with: name, slug, publication status, review status, last-edited time.
- FR-12: From the dashboard users can: continue editing, open preview, manage preview links, submit for review, unpublish, or delete an event.
- FR-13: Deletion requires an explicit confirmation step. Events that have ever been published are soft-deleted (recoverable/auditable by admins); never-published drafts may be hard-deleted.

### 1.4 Structured Content Editor
- FR-14: The editor is organized by content section (Hero/basics, About, Speakers, Team, Sponsors, Venue, FAQ, Contact/social). Users edit structured fields only — never layout, HTML, CSS, or components.
- FR-15: Editable content includes:
  - **Display name (required — see Business Rules: Display Name)**, **theme (optional, ≤100 characters — see Business Rules: Theme)**, about text
  - Event date & time (with timezone), venue name, address, venue description, venue image
  - Countdown target (derived from event date, when set)
  - Optional external registration URL (rendered as a "Register / Get Tickets" button)
  - Speakers: name, title/role, bio, photo, talk title, social links, display order
  - Team members: name, role, photo, social links, display order
  - Sponsors: name, logo, website URL, tier (`PARTNER`, `PLATINUM`, `GOLD`, `SILVER`, `BRONZE`, `COMMUNITY`), display order
  - FAQs: question, answer, display order
  - Contact email, social media links, hero/background imagery
- FR-15a: Event teams frequently start before their program is finalized (theme, date, venue, speakers, and other details may still be undecided). Accordingly, **every content field is optional during drafting except Display Name**, which is always required and can never be saved blank (it starts pre-filled from the slug at creation — FR-8 — and remains freely editable at any time, including after publication). Theme — the event's short theme/tagline phrase — is optional and capped at 100 characters. All other sections and fields may be left empty indefinitely and filled in later (see FR-17). A section or field left empty follows the normal auto-hide behavior on the public site (BR-13) — e.g., an unset event date hides the Countdown section. The one exception is Theme: since Hero is an always-rendered section, a blank Theme is replaced by platform-provided default hero copy rather than an empty subtitle or auto-hide (FR-38).
- FR-16: Autosave with debounce (no request per keystroke) and a visible status indicator: `Saving…`, `Saved`, `Save failed`, `Unsaved changes`. A manual "Save now" action exists as a fallback.
- FR-17: Drafts persist indefinitely; users can return at any time and continue.
- FR-18: List sections (speakers, team, sponsors, FAQs) support add, edit, remove.
- FR-19: All content is validated (lengths, URL formats, image types/sizes, item count limits) with clear inline error messages. Required-field validation (non-empty Display Name) is enforced on every save; all other fields validate format/length/limits only when a value is provided (Theme additionally enforces the 100-character cap). Field-level optionality here is independent of the separate submission completeness gate enforced before publishing (FR-30, BR-14) — a draft can be saved at any level of completeness, but publishing still requires passing that gate.

### 1.5 Image Upload & Media
- FR-20: Users upload images (speaker photos, team photos, sponsor logos, venue/hero imagery) via Cloudinary.
- FR-21: Uploads are validated: accepted image formats only (JPEG, PNG, WebP, AVIF; SVG allowed for sponsor logos only if sanitization is feasible, otherwise rejected), max 10 MB per image.
- FR-22: Public sites always serve Cloudinary-transformed/optimized renditions (resized, compressed, modern formats) — never raw originals.
- FR-23: Uploaded media is tracked in the database (`media_assets`) so orphaned uploads can be cleaned up and usage audited.

### 1.6 Preview
- FR-24: The event owner can always preview their current draft, rendered by the real template (identical to the public site).
- FR-25: The owner can create a secure, token-based, read-only preview link for the draft; anyone with the link can view it without an account.
- FR-26: The owner can revoke the current preview link and generate a new one.
- FR-27: Preview pages send `noindex` directives and are excluded from sitemaps.

### 1.7 Publishing Workflow (Draft / Published-Snapshot Model)
- FR-28: The public website always renders the **most recently approved snapshot**. Draft edits never affect the live site.
- FR-29: Submitting for review creates a publish request containing an immutable snapshot of the full event content at submission time.
- FR-30: An event can be saved as a draft regardless of completeness. However, before it can be submitted for review, the system must validate that all mandatory content has been provided. Optional sections (such as Speakers, Sponsors, FAQ, and Team) may remain empty and will be automatically hidden on the generated website. If any required information is missing, the submission must be blocked and the user should receive a clear list of the missing fields.
- FR-31: While a request is pending, the user can continue editing the draft and may cancel the pending request. Only one pending request per event at a time.
- FR-32: On approval, the submitted snapshot becomes the live site (first publish makes the site public; re-approval replaces the previous snapshot).
- FR-33: On rejection, the admin must provide a reason; the user sees it and can revise and resubmit.
- FR-34: Re-submission triggers a full review of the entire site (no diff-based review in V1).
- FR-35: Users can unpublish their own event at any time without admin approval (site goes offline; snapshot retained).

### 1.8 Public Website
- FR-36: Published sites are served at `tedxplore.com/tedx{slug}` (e.g., `/tedxabc`).
- FR-37: The V1 template renders these sections: Hero, Countdown, About, Speakers, Team, Sponsors, Venue, FAQ, Contact, About TED, About TEDx, and the required footer (including the TEDx disclaimer: "This independent TEDx event is operated under license from TED").
- FR-38: Always-rendered sections: Hero, About TED, About TEDx, Disclaimer, and Footer are always rendered — even for a brand-new event, since the only fields required to create one are the event slug and the display name (FR-8, FR-15a). The Hero has two organizer-editable elements that gracefully fall back to platform-provided defaults when unset — **Theme** (default subtitle copy) and **hero/background imagery** (default template visual treatment) — so the Hero always looks polished: the event's Display Name plus these defaults, until the organizer customizes them. About TED, About TEDx, and the Disclaimer are platform-authored template copy with no organizer-editable portion in V1 — they always display their standard content, unconditionally. All other sections (About, Venue, Speakers, Sponsors, Team, FAQ, Contact) are optional and auto-hide automatically when they have no usable content (BR-13) — no default fallback content for these; empty means hidden. Within Sponsors, each tier auto-hides independently when it has no sponsors.
- FR-39: After the event date passes, the countdown is replaced with an elegant "This event has taken place." state.
- FR-40: The registration button appears only when a registration URL exists and opens in a new tab safely (`rel="noopener noreferrer"`, URL validated as http/https).
- FR-41: Public sites include proper SEO metadata (title, description, Open Graph/Twitter cards using event imagery) and are fully responsive and animated.
- FR-42: Suspended, unpublished, deleted, or never-published slugs return a branded 404/unavailable page.

### 1.9 Admin & Moderation
- FR-43: An `/admin` area (same application, `ADMIN` role required) provides:
  - Review queue of pending publish requests, rendering the exact submitted snapshot
  - Approve / reject (rejection reason required)
  - Suspend a published site / restore a suspended site
  - Report inbox with report details and resolution actions
  - Event detail view: ownership, official TED page URL, license holder name, publication history
- FR-44: Suspension immediately takes the public site offline and notifies the owner.

### 1.10 Public Reporting
- FR-45: Every public site includes a discreet "Report this site" affordance.
- FR-46: The report form collects: reason category (e.g., impersonation/not authorized, inappropriate content, spam/scam, copyright, other), a free-text explanation, and an optional reporter email.
- FR-47: Report submission is rate-limited per IP and protected against automated abuse (honeypot field + rate limits in V1).

### 1.11 Transactional Email (Resend)
- FR-48: The system sends: email verification, password reset, "submission received", "site approved", "site rejected (with reason)", and "site suspended" notifications.

### 1.12 Public Homepage & Template Browsing
- FR-49: The homepage is publicly browsable without authentication. It lists all available templates as cards (V1 ships one template, `aurora`, so the grid shows a single card; the layout is built to scale to a multi-template grid per the future roadmap).
- FR-50: Each template card shows two actions:
  - **Live Preview** — opens the template's live demo site (rendered from the template's `demoContent` through the same public renderer) in a new tab. No account required.
  - **Edit** — begins customizing that template.
- FR-51: An unauthenticated visitor who clicks **Edit** is prompted to log in or sign up first. After successful authentication, they are returned to event creation for the selected template (FR-8), not dropped back at the homepage.

---

## 2. Non-Functional Requirements

- NFR-1 **Design quality**: generated sites must feel premium, cinematic, modern — strong typography, generous spacing, smooth scroll-driven animations. Explicitly avoid generic-template aesthetics.
- NFR-2 **Performance**: public sites target Lighthouse ≥ 90 (Performance, SEO, Best Practices); optimized images, minimal JS on public pages, animations that respect `prefers-reduced-motion`.
- NFR-3 **Accessibility**: WCAG 2.1 AA intent — semantic HTML, keyboard navigability, focus states, alt text (user-supplied where content-bearing), sufficient contrast.
- NFR-4 **Responsiveness**: flawless from 360 px phones to large desktops.
- NFR-5 **Security**: authorization on every mutation (owner or admin); server-side validation of all input; secure preview tokens (≥ 256-bit random); no template-injection or XSS via user content; rate limiting on abuse-prone endpoints.
- NFR-6 **Scalability of templates**: adding Template 2 must require only a new presentation layer — zero schema changes, zero editor changes.
- NFR-7 **Maintainability**: clean layering (domain / data access / presentation), strong TypeScript typing end-to-end, centralized configuration (limits, reserved slugs, section registry).
- NFR-8 **Data integrity**: snapshots are immutable; soft-deleted data is auditable; slug uniqueness is DB-enforced.
- NFR-9 **Portability**: database access isolated behind a data-access layer so the Postgres provider can change without touching domain or UI code.

---

## 3. User Roles

| Role | Description | Capabilities |
|---|---|---|
| Visitor | Anonymous public user | Browse templates on the homepage, open a template's live preview, view published sites, view valid preview links, submit reports |
| User (organizer) | Registered account | Everything a visitor can, plus: create/edit/delete own events, manage preview links, submit for review, unpublish own sites |
| Admin | Platform operator (`role = ADMIN`) | Everything a user can, plus: review queue, approve/reject, suspend/restore, report inbox, inspect ownership/licensing info |

No organizations, collaborators, or granular permissions in V1 (schema designed so these can be added later).

---

## 4. User Flows

### 4.0 Visitor: browsing templates
1. Open the homepage (no account needed) → see the template grid.
2. **Live Preview** on a card → demo site opens in a new tab; visitor can leave without ever signing up.
3. **Edit** on a card → prompted to log in or sign up → on success, lands in event creation for that template (continues at 4.1 step 2).

### 4.1 Organizer: first website
1. Sign up (email/password → verify email, or Google) → land on dashboard. (Or arrive here directly from the homepage's Edit button, per 4.0.)
2. "Create event" → enter slug (lowercase-only, live `tedxplore.com/tedx{slug}` URL preview) and display name (pre-filled with a suggested default from the slug, freely editable), authorization checkbox, TED page URL, license holder name.
3. Event created as draft pre-filled with demo content → enter editor.
4. Edit section by section; autosave keeps status visible; upload images.
5. Preview at any time; optionally create a shareable preview link for teammates.
6. Submit for review (completeness check runs first) → confirmation + email.
7. Admin approves → approval email → site live at `/tedx{slug}`.

### 4.2 Organizer: updating a live site
1. Edit draft freely — live site unaffected.
2. Submit for review → new snapshot created → pending.
3. Approved → live site swaps to new snapshot. Rejected → reason shown, revise, resubmit.

### 4.3 Organizer: unpublish / delete
- Unpublish: immediate, no approval; site returns 404-style page; can resubmit later.
- Delete: confirmation dialog → soft delete if ever published (admin-recoverable), hard delete otherwise; slug released only on hard delete.

### 4.4 Admin: review
1. Open `/admin` → pending queue.
2. Open a request → view rendered snapshot + ownership/licensing info.
3. Approve, or reject with required reason. Owner notified by email either way.

### 4.5 Admin: moderation
1. Report arrives → report inbox.
2. Inspect site → resolve report, or suspend site (owner emailed) → optionally restore later.

### 4.6 Visitor
- Visit `/tedx{slug}` → view site → optionally report it.
- Visit preview URL with valid token → view draft (noindex, read-only).

---

## 5. Business Rules

### Slug, Display Name, and Theme — three distinct fields

Slug, Display Name, and Theme serve entirely different purposes and must never be conflated: **Slug** is a URL-only technical identifier; **Display Name** is the human-readable event name shown throughout the UI; **Theme** is an optional short tagline/theme phrase. They have independent charsets, independent uniqueness rules, and independent editability rules.

### Slug
- BR-1: Slug charset: **lowercase letters only** (`a–z`) — no uppercase, no numbers, no hyphens, no spaces, no other characters; length 2–50. The slug is always stored in this lowercase form (there is no separate casing to normalize).
- BR-2: The slug is used exclusively to build the public URL: `tedxplore.com/tedx{slug}` (e.g., slug `mcgillu` → `/tedxmcgillu`). It is never used to derive or display the event's name — that is Display Name's role.
- BR-3: Slugs are globally unique (plain equality on the stored value) and reserved at creation.
- BR-4: Reserved/system values are rejected via a centralized blocklist (e.g., `admin`, `api`, `auth`, `login`, `dashboard`, `preview`, `plore`, `press`, `about`, `terms`, `privacy`, `support`, `www`, `mail`, plus offensive terms).
- BR-5: Slug is editable only before first publication; locked permanently once published (even if later unpublished).

### Display Name
- BR-5a: Display Name is used anywhere the event's name is shown in the UI — navigation bar, page title, Hero/event header (e.g., `TEDxMcGill University`). It is a separate field from slug, entered independently.
- BR-5b: Charset: letters of any case, spaces, accented/Unicode letters, and hyphens are allowed; **digits are not allowed**. Display Name does **not** need to be unique — multiple events may share the same display name.
- BR-5c: At creation, the form pre-fills a simple suggested default (`TEDx` + capitalized slug), which the user is free to overwrite entirely (e.g., to add proper capitalization or extra words, as in "TEDxMcGill University"). Display Name can never be saved blank. Unlike slug, it remains freely editable at any time, including after publication, since it carries no uniqueness or URL implications.

### Theme
- BR-5d: Theme is optional and represents the event's theme or tagline as a short phrase or sentence, capped at **100 characters** (centrally configured, consistent with the limits in BR-11). When left blank, the Hero section (an always-rendered section) displays platform-provided default subtitle copy instead of an empty subtitle (FR-38).

### Publishing & lifecycle
- BR-6: Event publication states: `NEVER_PUBLISHED` → (`approval`) → `PUBLISHED` ↔ `UNPUBLISHED` (owner action) / `SUSPENDED` (admin action). Deleted is orthogonal (soft-delete flag).
- BR-7: Exactly one live snapshot per event; approval atomically replaces it.
- BR-8: Snapshots are never mutated after creation; every submission creates a new snapshot; each snapshot records its `schemaVersion`; all snapshots (superseded and rejected included) are retained for audit and possible restoration.
- BR-8a: The approved snapshot remains live while newer changes exist in draft or are pending review. Republishing an unpublished event whose live snapshot is unchanged requires no new review; changed content always goes through review.
- BR-9: One pending publish request per event; user may cancel it.
- BR-10: Suspension overrides publication: a suspended site is offline regardless of snapshot state; only an admin can restore.

### Content
- BR-11: Content limits (centralized config, single source of truth): 16 speakers, 30 team members, 30 sponsors, 30 FAQs, 10 MB per image, 100 characters for Theme (BR-5d).
- BR-12: All user-provided URLs must be http/https; external links open with `noopener noreferrer`.
- BR-13: A section is "empty" (auto-hidden) when it has zero usable items / no non-blank content.
- BR-14: Submission completeness minimum: display name, theme or about text, event date, venue name, contact email. (Exact list finalized during implementation of the completeness check.)

### Moderation & abuse
- BR-15: Report submissions: max 3 per IP per hour per site (DB-backed rate limit; expired rate-limit records are cleaned up efficiently — see tech-stack decision 5).
- BR-16: Authorization affirmation (checkbox timestamp), TED page URL, and license holder name are stored on the event and visible to admins; verification is a manual admin responsibility in V1.

---

## 6. Out of Scope (Version 1)

- Multiple production templates (architecture supports them; only one ships)
- Custom domains (`tedxabc.com`)
- Multilingual / RTL support
- Analytics dashboard
- AI features
- Blogging / news
- Ticketing integrations (only an external registration link)
- Template marketplace
- Public event discovery / directory
- Drag-and-drop or visual design editing
- Organizations, collaborators, advanced permissions
- Recorded talks / post-event content
- Schedule / program section (deferred; reintroduced later via an `EventContent` schema-version bump and a template addition)
- Diff-based review
- In-app admin ↔ organizer messaging beyond rejection reasons

---

## 7. Future Roadmap (design-for, don't build)

1. **Template gallery**: multiple templates browsable as cards with animated previews, live demo links, per-event template switching. (Template registry pattern from day one.)
2. **Organizations**: group events (editions) under one organizer entity.
3. **Collaborators**: multiple users per event with roles.
4. **Custom domains** with automated DNS/SSL.
5. **Schedule / program section**: event agenda with talk times, item types, and speaker links.
6. **Post-event mode**: recorded talks, photo galleries.
7. **Discovery**: public directory of TEDx events.
8. **Analytics** for organizers.
9. **Diff-based re-review** to speed up moderation.

---

## 8. Assumptions

- A-1: The platform operator (you) is the sole admin in V1; admin role is set directly in the database or via seed script.
- A-2: Tedxplore itself is an independent tool; organizers remain responsible for TEDx license compliance. The platform enforces the standard TEDx disclaimer and collects licensing attestations but does not verify licenses automatically.
- A-3: English-only UI and sites in V1.
- A-4: Single-day events in V1. There is no schedule/program section in V1; when reintroduced, it will be an additive `EventContent` schema-version bump plus a template section — no disruptive migration.
- A-5: Traffic is modest at launch; Neon + Vercel serverless scales far beyond V1 needs.
- A-6: Demo/template placeholder content is authored by us and seeded into every new event.

## 9. Constraints

- C-1: Stack fixed: Next.js (App Router) + TypeScript + Tailwind + shadcn/ui + Motion (Framer Motion), Prisma + Neon PostgreSQL, Better Auth, Cloudinary, Resend, Vercel.
- C-2: The database schema must contain no template-specific fields; the editor must be template-independent.
- C-3: Users can never edit code, layout, or styling — structured content only.
- C-4: Public rendering must come exclusively from approved snapshots, never live draft tables.
- C-5: All limits and reserved words live in centralized, typed configuration.
