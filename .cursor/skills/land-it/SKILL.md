---
name: land-it
description: Finalize and ship agent work in the chincha monorepo — verify, commit, push, and open or update a PR. Use when finishing a task, before merge, or when the user says land it, ship it, or open a PR.
---

# Land it (chincha monorepo)

Close out a coding task with a clean git state and a reviewable PR.

## Scope routing

| Paths touched | App | Verify before PR |
|---------------|-----|------------------|
| `apps/seafood-pos/**` | กุ้ง (shrimp) | `node apps/seafood-pos/scripts/smoke-test.mjs` then `npm run build --workspace=seafood-pos` |
| `apps/chincha-tea/**` | ชา (tea) | `npm run build --workspace=chincha-tea` |
| `apps/webhook-core/**` | LINE functions | Deploy-only; no local HTTP server — note deploy region `asia-southeast1` in PR |
| Root shared (`package.json`, `firebase.json`, …) | Both PWAs | Run builds for every app whose workspace deps changed |

Do not edit the other PWA unless the user asked explicitly.

## Checklist

1. **Diff review** — Changes match the request; no unrelated files; no `.env.local` or secrets committed.
2. **Verify** — Run the commands for each touched app (from repo root after `npm install` if needed).
3. **Commit** — One or more focused commits; complete sentences in messages; explain what and why.
4. **Push** — `git push -u origin <branch>` (branch names use `cursor/<name>-d95c` for cloud agents).
5. **PR** — Create or update a draft PR to `main` with: summary, apps affected, verification commands run, production URLs if user-facing.

## PR body hints

- กุ้ง production: https://ko-seafood.top
- ชา production: https://chincha-tea.web.app
- Hosting deploy: merge to `main` triggers `.github/workflows/deploy-hosting.yml` per changed app.

## Slack / Cloud Agent

Work from `#chincha-shrimp-agent` should stay in `apps/seafood-pos`; `#chincha-tea-agent` in `apps/chincha-tea`. Mention the channel or app in the PR if relevant.
