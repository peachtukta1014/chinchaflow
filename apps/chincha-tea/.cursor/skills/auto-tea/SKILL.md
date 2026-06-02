---
name: auto-tea
description: Automated tea (chincha-tea) health check from Slack — install, build, and report. Use for /auto-tea, ชาสุขภาพ, or quick verify on #chincha-tea-agent without a feature task.
---

# Auto-tea (ชา — automated verify)

One-shot routine for `#chincha-tea-agent`. No code changes unless something fails.

## Run (repo root)

```bash
npm install
npm run build --workspace=chincha-tea
```

There is no logic smoke script for tea (unlike shrimp); production build is the automated gate.

## Report back

Post a short summary to the Slack thread:

- Pass/fail for build
- Branch/commit if relevant (`main` or agent branch)
- Open PR link if agent work is pending merge
- Production: https://chincha-tea.web.app
- If failed: first error line and suggested fix scope (`apps/chincha-tea` only)

## Scope

- Stay in `apps/chincha-tea` unless fixing a failure requires webhook code in `apps/webhook-core`
- Do not edit `apps/seafood-pos/`
- For deploy after merge use `/deploy-tea` or merge to `main` (`.github/workflows/deploy-hosting.yml` → `deploy_tea`)
- For PR workflow use `/land-it`

## Notes

- Default UI language is Myanmar (`my`) for staff
- Runtime auth needs `apps/chincha-tea/.env.local` (not required for build)
