---
name: deploy-tea
description: Build and ship the Chincha Tea POS PWA. Use for ชา deploy, hosting release, chincha-tea.web.app, or Firebase Hosting target tea.
---

# Deploy Chincha Tea

App path: `apps/chincha-tea` · Production: https://chincha-tea.web.app · Firebase project: `chincha-eeed6` · Hosting target: `tea`

## Local verify

From repo root:

```bash
npm install
npm run build --workspace=chincha-tea
```

There is no seafood-style smoke script for tea; production build is the main automated check.

## Dev server

```bash
npm run dev:tea
```

Default http://localhost:5173 (or next free port). Restart after changing `apps/chincha-tea/.env.local`.

## Environment

Runtime needs `apps/chincha-tea/.env.local` with `VITE_FIREBASE_*`. Tea uses **`VITE_FIREBASE_APP_ID` for the tea app** (different from shrimp). CI uses `VITE_FIREBASE_APP_ID_TEA` in GitHub Actions secrets — see `.github/workflows/deploy-hosting.yml`.

Bootstrap admin email: `BOOTSTRAP_ADMIN_EMAIL` in `apps/chincha-tea/src/lib/constants.js`.

## Production deploy

Automatic on push to `main` when `apps/chincha-tea/**` (or shared root deps) change:

- Workflow: `.github/workflows/deploy-hosting.yml` → job `deploy_tea`
- Build: `npm run build --workspace=apps/chincha-tea`
- Deploy: Firebase Hosting target `tea`, channel `live`

Manual dispatch: GitHub Actions → **Deploy Firebase Hosting** → enable **Deploy Chincha Tea**.

## Agent close-out

For Peach / `#chincha-tea-agent` work that should go live after a PR: use **`/ship-tea`** (verify build → merge PR to `main` → monitor `deploy-hosting.yml`). This skill documents deploy mechanics; `ship-tea` runs the full pipeline.

## Scope

Stay in `apps/chincha-tea` unless the task is tea LINE webhook code in `apps/webhook-core`. Do not edit `apps/seafood-pos/` unless the user asks.
