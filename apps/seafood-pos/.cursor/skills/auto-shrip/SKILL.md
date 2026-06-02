---
name: auto-shrip
description: Automated shrimp (seafood-pos) health check from Slack — install, smoke test, build, and report. Use for /auto-shrip, กุ้งสุขภาพ, or quick verify on #chincha-shrimp-agent without a feature task.
---

# Auto-shrip (กุ้ง — automated verify)

One-shot routine for `#chincha-shrimp-agent`. No code changes unless something fails.

## Run (repo root)

```bash
npm install
node apps/seafood-pos/scripts/smoke-test.mjs
npm run build --workspace=seafood-pos
```

## Report back

Post a short summary to the Slack thread:

- Pass/fail for smoke + build
- Branch/commit if relevant (`main` or agent branch)
- Production: https://ko-seafood.top
- If failed: first failing assertion and suggested fix scope (`apps/seafood-pos` only)

## Scope

- Stay in `apps/seafood-pos` unless fixing a failure requires webhook code in `apps/webhook-core`
- Do not edit `apps/chincha-tea/`
- For merge + deploy after feature work use `/ship-shrimp` (not this skill — `auto-shrip` is verify-only)
- For deploy reference use `/deploy-shrimp` or merge to `main` (`deploy-hosting.yml` → `deploy_shrimp`)
- For PR workflow use `/land-it`

## Notes

- Smoke tests need no Firebase login
- Runtime auth still needs `apps/seafood-pos/.env.local` (not required for this skill)
