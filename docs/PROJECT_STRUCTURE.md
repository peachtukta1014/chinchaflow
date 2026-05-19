# Project Structure

## Apps

- `apps/seafood-pos` — POS กุ้ง (React + Vite + Firebase) ✅
- `apps/chincha-tea` — ร้านชา POS (React + Vite + Firebase) 🔲
- `apps/webhook-core` — LINE Webhook + Firebase Functions 🔲

## Packages

- `packages/firebase` — shared Firebase config
- `packages/shared-ui` — shared React components
- `packages/utils` — shared utilities

## Main Stack

- React + Vite
- Firebase (Firestore, Storage, Hosting, Functions)
- GitHub Actions (auto deploy)
- PWA (mobile-first)

## Firebase Project

- Project ID: `chincha-eeed6`
- Hosting targets:
  - `shrimp` → chincha-shrimp (seafood-pos)
  - `tea` → chincha-tea (chincha-tea app)

## Deploy Flow

```
push to main
  ├── deploy_shrimp → Firebase Hosting (chincha-shrimp)
  └── deploy_tea    → Firebase Hosting (chincha-tea)
```
