# CHINCHA PR1: Backend foundation and debuggable service core

> Source: Issue #254 was requested, but the private GitHub issue body is not readable from this agent session (`gh` unavailable / GitHub API returned 404). This file preserves the Issue #254 content available in the Slack task context so agents can work from repo-local specs without a long prompt.

## Goal

Build PR1 backend foundation for the Chincha Tea app so future PRs can debug operations by role, user code, actor snapshot, branch, service layer, purchase/restock status, and history logs.

## Scope

- App: Chincha Tea only
- Primary code scope: `apps/chincha-tea/`
- Allowed supporting docs/config when needed: repo docs and Firestore rules
- Do not apply this spec to Seafood POS
- Do not touch LINE backend unless a future spec explicitly says so

## Requirements

- Add/standardize roles: `admin`, `manager`, `staff`
- Add `userCode` foundation for tea users; generated codes are deterministic fallbacks until real staff codes are assigned (`ADM-*`, `MGR-*`, `STF-*`)
- Add actor snapshot foundation for write operations
- Add `branchId` foundation
- Add service layer foundation for debuggable backend writes
- Add purchase/restock status foundation: `pending`, `picked`, `pending_confirm`, `received`, `cancelled` (`purchased` legacy alias/fallback only)
- Add history log foundation

## Do Not Touch

- Do not do a large UI rewrite
- Do not touch Seafood POS
- Do not touch `webhook-core` unless necessary
- Do not add real stock from `pending_confirm`
- Only `received` may add real stock; `picked` and `pending_confirm` must not update `stock_base_qty`
- Must remain backward compatible with existing data

## PR title

`CHINCHA PR1: Backend foundation and debuggable service core`
