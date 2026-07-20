# Tedxplore

A no-code platform that generates premium TEDx-style event websites from structured event data. See `CLAUDE.md`, `project-scope.md`, `tech-stack.md`, and `implementation-plan.md` for the full picture.

## Getting started

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Local database

Until a Neon project is connected (via Vercel), this uses a local Postgres instance. Create a dedicated database on it:

```bash
psql -U postgres -h localhost -c "CREATE DATABASE tedxplore;"
```

Then copy `.env.example` to `.env` and point `DATABASE_URL`/`DIRECT_URL` at it (both the same for local dev, since there's no pooler):

```
postgresql://postgres:postgres@localhost:5432/tedxplore?schema=public
```

Apply migrations with `pnpm exec prisma migrate dev`. `/api/health` reports `{"status":"ok","db":"ok"}` when the app can reach the database.

## Scripts

- `pnpm dev` / `pnpm build` / `pnpm start`
- `pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm format`
