---
name: run-chincha-tea
description: run, start, build, screenshot, verify chincha-tea Tea POS web app (ชา)
---

# run-chincha-tea

Tea POS web app (ร้านชา) — Vite + React, หลายภาษา (ไทย/พม่า/EN), driven headlessly with chromium.
Login page render ครบโดยไม่ต้อง Firebase key — เห็น UI จริงได้เลย

## Prerequisites

```bash
# จาก repo root — ต้องรันก่อนครั้งแรก
npm install
```

## Build

```bash
cd apps/chincha-tea
../../node_modules/.bin/vite build
```

## Run (agent path)

```bash
# 1. Start dev server (background) — เพิ่ม --host 0.0.0.0 เพื่อให้ chromium เข้าได้
cd apps/chincha-tea
../../node_modules/.bin/vite --host 0.0.0.0 --port 5175 &
sleep 4

# 2. Screenshot
/opt/pw-browsers/chromium --headless --no-sandbox --disable-gpu \
  --screenshot=/tmp/chincha-tea.png \
  --window-size=1280,800 \
  "http://127.0.0.1:5175/"

# 3. ดูผล — ควรเห็น login page + CHINCHA logo + language selector (ไทย/ မြန်မာ/EN)

# 4. Stop server
kill $(lsof -ti:5175)
```

## Run (human path)

```bash
cd apps/chincha-tea
npm run dev   # → http://localhost:5173 (default port, ไม่ expose --host)
```

## Gotchas

- **`npm run dev` ไม่มี `--host`** → binds localhost only, curl ผ่าน `127.0.0.1` ได้แต่ `0.0.0.0` ไม่ได้ — เมื่อ agent ใช้ให้เพิ่ม `--host 0.0.0.0` เสมอ
- **CLAUDE.md ระบุ**: `dev:tea binds IPv6 loopback` — เกิดเมื่อใช้ `npm run dev` ปกติ; ถ้าเพิ่ม `--host 0.0.0.0` จะ bind ทุก interface รวม IPv4
- **Login page render ครบโดยไม่มี `.env.local`** — ต่างจาก seafood-pos ที่ค้างที่ loading state ชา render หน้า login เลย
- **ต้องใช้ `../../node_modules/.bin/vite`** — ไม่มี local vite ใน app

## Troubleshooting

| อาการ | สาเหตุ + วิธีแก้ |
|-------|-----------------|
| chromium เปิดหน้าขาว / ไม่โหลด | ลืมใส่ `--host 0.0.0.0` ตอน start server |
| `EADDRINUSE :5175` | `kill $(lsof -ti:5175)` |
| port 5173 แทน 5175 | เพิ่ม `--port 5175` หรือใช้ default 5173 และ screenshot ที่ `http://127.0.0.1:5173/` |
