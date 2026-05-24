# Project Structure

## Apps

- `apps/seafood-pos` — POS กุ้ง (React + Vite + Firebase) ✅
  - `src/main.jsx` + `src/App.jsx` + `src/screens/` + `src/services/` (แยกแล้ว)
  - แผน: สลิปยืนยันซื้อของที่รับสต๊อก (คล้าย `orderSlipService` ฝั่งชา → `stockPurchaseSlips` / ผูก `stockBatches`)
- `apps/chincha-tea` — ร้านชงชา/กาแฟ/ผลไม้ปั่น — บันทึกยอดขายรายวัน (React + Vite + Firebase)
  - `src/main.jsx` — entry only
  - `src/App.jsx` — shell, auth, tabs, cart
  - `src/screens/` — แท็บหลัก (ขาย, ประวัติ, สรุป, สั่งของ, แอดมิน)
  - `src/components/` — UI ย่อย (เมนู, ตะกร้า, header)
  - `src/lib/orderSlipService.js` — อัปโหลดสลิปใบสั่งของ (`orderSlips`)
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
