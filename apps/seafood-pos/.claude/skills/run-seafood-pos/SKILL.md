---
name: run-seafood-pos
description: run, start, build, screenshot, verify seafood-pos shrimp POS web app (กุ้ง)
---

# run-seafood-pos

Shrimp POS web app (กุ้ง) — Vite + React, driven headlessly with chromium.
Dev server starts on port 5174 (configurable). Without `.env.local` the app renders but hangs at "กำลังโหลด..." (Firebase auth not wired).

## Prerequisites

```bash
# จาก repo root — ต้องรันก่อนครั้งแรก
npm install
```

Root `node_modules/.bin/vite` เป็น binary ที่ใช้ (app ไม่มี local vite)

## Build

```bash
cd apps/seafood-pos
../../node_modules/.bin/vite build
```

## Run (agent path)

```bash
# 1. Start dev server (background)
cd apps/seafood-pos
../../node_modules/.bin/vite --host 0.0.0.0 --port 5174 &
sleep 4

# 2. Screenshot
/opt/pw-browsers/chromium --headless --no-sandbox --disable-gpu \
  --screenshot=/tmp/seafood-pos.png \
  --window-size=1280,800 \
  "http://127.0.0.1:5174/"

# 3. ดูผล (loading state ถ้าไม่มี .env.local = ปกติ)

# 4. Stop server
kill $(lsof -ti:5174)
```

## Run (human path)

```bash
cd apps/seafood-pos
npm run dev   # → http://localhost:5174 (binds 0.0.0.0)
```

## Smoke test (ไม่ต้อง Firebase)

```bash
cd /home/user/chinchaflow   # repo root จำเป็น
node apps/seafood-pos/scripts/smoke-test.mjs
```

คาด: ผ่าน 14/15 — ล้มที่ `shrimpBillServerRender: โหลดรูปไม่สำเร็จ: /logo.jpg` เพราะ logo.jpg ไม่มีในสภาพ headless นี่คือ expected failure

## Gotchas

- **ต้องใช้ `--host 0.0.0.0`** เมื่อ start สำหรับ chromium — ไม่งั้น chromium เข้าไม่ได้ (default binds localhost only)
- **วิ่งจาก `apps/seafood-pos/`** ต้องใช้ `../../node_modules/.bin/vite` ไม่มี local vite ใน app
- **`กำลังโหลด...` = ปกติ** ถ้าไม่มี `.env.local` — Firebase ไม่ทำงาน แต่ UI render ได้
- **smoke test ต้อง run จาก repo root** ไม่ใช่จาก apps/seafood-pos/ มิเช่นนั้น path ไฟล์หาย
- **logo.jpg failure คาดเดาได้** ใน headless container ไม่ต้อง fix

## Troubleshooting

| อาการ | สาเหตุ + วิธีแก้ |
|-------|-----------------|
| `Cannot find module 'vite'` | อยู่ผิด dir หรือ npm install ยังไม่รัน — ใช้ `../../node_modules/.bin/vite` |
| chromium screenshot ว่าง/ดำ | เพิ่ม `sleep 4` หลัง start server ก่อน screenshot |
| `EADDRINUSE :5174` | `kill $(lsof -ti:5174)` ก่อน start ใหม่ |
