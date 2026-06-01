---
name: deploy-shrimp
description: Build, verify, and ship the Shrimp POS (seafood-pos) PWA. Use for กุ้ง deploy, hosting release, ko-seafood.top, or Firebase Hosting target shrimp.
---

# Deploy Shrimp POS

App path: `apps/seafood-pos` · Production: https://ko-seafood.top · Firebase project: `chincha-eeed6` · Hosting target: `shrimp`

## Local verify (no Firebase login)

From repo root:

```bash
npm install
node apps/seafood-pos/scripts/smoke-test.mjs
npm run build --workspace=seafood-pos
```

Smoke test is logic-only regression; it must pass before merge.

## Dev server

```bash
npm run dev:seafood
```

Vite uses `--host 0.0.0.0`. Restart after changing `apps/seafood-pos/.env.local`.

## Environment

Runtime needs `apps/seafood-pos/.env.local` with `VITE_FIREBASE_*`. Shrimp uses **`VITE_FIREBASE_APP_ID` for the shrimp app** (different from tea). CI uses `VITE_FIREBASE_APP_ID_SHRIMP` in GitHub Actions secrets — see `.github/workflows/deploy-hosting.yml`.

Do not commit `.env.local`. Cloud agents: set secrets in Cursor Dashboard, not in git.

## Production deploy

Automatic on push to `main` when `apps/seafood-pos/**` (or shared root deps) change:

- Workflow: `.github/workflows/deploy-hosting.yml` → job `deploy_shrimp`
- Build: `npm run build --workspace=apps/seafood-pos`
- Deploy: Firebase Hosting target `shrimp`, channel `live`

Manual dispatch: GitHub Actions → **Deploy Firebase Hosting** → enable **Deploy Shrimp POS**.

## Scope

Stay in `apps/seafood-pos` unless the task is shrimp LINE webhook code in `apps/webhook-core`. Do not edit `apps/chincha-tea/` unless the user asks.

## PWA note

If users report a stale PWA after deploy, use the in-app reload control or re-add to home screen.
