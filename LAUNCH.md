# Tedxplore — Go-Live Runbook (Phase 10.6)

The step-by-step for taking the Phase 10 build to production. Background and the
_why_ behind each service live in **`deployment-guide.md`**; this is the short,
ordered checklist for the actual launch.

Legend: **[you]** needs Mohammad (dashboard, DNS, admin login, deploy);
**[done]** already true; **[claude]** a code/doc change already committed.

Current production: **https://tedxplore.vercel.app** — GitHub `ateymori/tedxplore`,
push to `main` auto-deploys to Vercel production; Neon Postgres via the Vercel
Marketplace; Resend + Cloudinary configured.

---

## 1. Pre-deploy gate (green before pushing)

- [done] `pnpm lint`, `pnpm typecheck`, `pnpm test` (379 unit) all pass.
- [done] `pnpm test:e2e` — 7 Playwright flows green (run locally on `:3000`).
- [done] `pnpm build` succeeds; production headers/CSP verified over HTTP.
- [you] CI green on the pushed commits (lint/type/test/build **+ the new `e2e` job**).

## 2. Environment variables (Vercel → Settings → Environment Variables)

Already set for Production + Preview: `DATABASE_URL`/`DATABASE_URL_UNPOOLED`
(Neon-injected), `BETTER_AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`, `RESEND_API_KEY` +
`EMAIL_FROM`, `CLOUDINARY_API_KEY`/`_SECRET` + `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`.

- [you] **Add `CRON_SECRET`** (new in 10.4) — `openssl rand -base64 32`.
  Required for the maintenance cron: without it, `/api/cron/sweep` is
  fail-closed (refuses everyone) in production, and the scheduled sweep can't run.

## 3. Deploy Phase 10

- [you] **Push `main`** (or Redeploy). This is the deploy — it auto-ships to
  production. Watch the build log: `prisma migrate deploy` → `next build` → Ready.
- [you] `GET https://tedxplore.vercel.app/api/health` → `{"status":"ok","db":"ok"}`.

## 4. Periodic maintenance cron (deferred from 10.4)

The rate-limit sweep endpoint exists (`/api/cron/sweep`) but nothing triggers it
on a schedule yet — the `vercel.json` was intentionally left out pending sign-off.

- [you] Add `vercel.json` at the repo root and redeploy:
  ```json
  { "crons": [{ "path": "/api/cron/sweep", "schedule": "0 3 * * *" }] }
  ```
  (Daily 03:00 UTC. Hobby plan caps crons at once/day. Only adds `crons`; the
  `vercel-build` command and other dashboard settings are untouched.) Requires
  `CRON_SECRET` from step 2 — Vercel sends it as the cron's `Authorization` header.
- The **orphaned-media** cleanup is deliberately **not** on the cron (it deletes
  Cloudinary assets). Run it by hand, dry-run first:
  `pnpm exec tsx --tsconfig tsconfig.script.json scripts/cleanup-orphaned-media.ts`
  then `--apply`.

## 5. Admin

- [done] `ma.shamshiri@gmail.com` is `ADMIN` on the production database
  (`scripts/grant-admin.ts`). No admin-granting UI exists by design — the script
  is the only path.
- [you] Confirm admin access on the live site: sign in and open `/admin`
  (queue, reports, events all render).

## 6. Post-deploy verification on the live site

- [you] **Lighthouse** on a live published event site (`/tedx{slug}`), desktop
  preset, against production. Target: **94 performance / 100 a11y / 100
  best-practices / 100 SEO, LCP ≈ 1.6s** (the Phase 8 baseline; 10.3's font fix
  only shrinks the event-site payload, so it cannot regress it). This is the
  numeric run 10.3 deferred here because it needs the deployed site.
- [you] Browser smoke as a real user: homepage → Live Preview; create an event →
  edit → submit; as admin, approve → the site is live at `/tedx{slug}`; submit a
  report from the live footer; share + revoke a preview link.
- [you] Confirm security headers on production: `curl -sI https://tedxplore.vercel.app/`
  shows the CSP, `Strict-Transport-Security`, `X-Content-Type-Options`,
  `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`.

## 7. Domain (optional — not blocking launch)

`tedxplore.com` is **not owned yet**; the product runs on `tedxplore.vercel.app`.
When acquired:

- [you] Add the domain in Vercel → Settings → Domains and follow the DNS steps.
- [you] Update `NEXT_PUBLIC_APP_URL` to `https://tedxplore.com` (Better Auth signs
  cookies against this origin — it must match the live host exactly).
- [you] Verify the domain in Resend (SPF/DKIM) and switch `EMAIL_FROM` off the
  shared `onboarding@resend.dev` sender so verification/reset/notification emails
  deliver to real inboxes instead of only the Resend owner's spam folder.

## 8. Known deliverability caveat (pre-domain)

Until a real domain is verified in Resend, outbound email sends from
`onboarding@resend.dev`, which **only delivers to the Resend account owner and
lands in spam**. Sign-up email verification therefore works end-to-end only for
that address in production. This is a deliverability limitation, not a code bug —
resolved by step 7's Resend domain verification.
