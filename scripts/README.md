# scripts/

One-off Node scripts run by hand against the database or a running server —
never part of the app build or request path.

They run through `tsx` with a dedicated tsconfig that shims two modules the
service layer pulls in but a plain script can't load (`server-only`,
`next/font/google`):

```bash
pnpm exec tsx --tsconfig tsconfig.script.json scripts/<name>.ts
```

## Operational (you will run these)

| Script | What it does |
|---|---|
| `grant-admin.ts` | Grants/revokes ADMIN on a user. `grant-admin.ts <email>` (`--revoke` to reverse). The only path to an admin account. |
| `cleanup-orphaned-media.ts` | Reaps Cloudinary assets no draft or retained snapshot references. Dry-run by default; `--apply` actually deletes. **Manual only — never wire this to the cron.** |

## Support

| Path | What it is |
|---|---|
| `stubs/next-font-google.ts` | Runtime shim for `next/font/google` (a build-time transform) so scripts touching the template registry can run. Mapped in `tsconfig.script.json`. |

## archive/

Finished phase-verification harnesses (`verify-8-*`, `verify-9-*`). They proved
a phase's behavior over real HTTP at the time it shipped and are kept for
reference only — not run, not maintained. Safe to delete; they live in git
history regardless.
