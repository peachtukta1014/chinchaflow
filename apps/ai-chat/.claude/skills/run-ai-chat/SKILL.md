---
name: run-ai-chat
description: run, start, build, screenshot, verify ai-chat AI Admin Chat web app (จจี้)
---

# run-ai-chat

AI Admin Chat — Vite + React, หน้า chat กับ Flash (จจี้) สำหรับเจ้าของร้านเท่านั้น
Login ผ่าน Google OAuth, whitelist เฉพาะ `peachtukta1014@gmail.com`

## Prerequisites

```bash
# จาก repo root — ต้องรันก่อนครั้งแรก
npm install
```

## Build

```bash
cd apps/ai-chat
../../node_modules/.bin/vite build
```

## Run (agent path)

```bash
# 1. Start dev server (background)
cd apps/ai-chat
../../node_modules/.bin/vite --host 0.0.0.0 --port 5176 &
sleep 4

# 2. Screenshot
/opt/pw-browsers/chromium --headless --no-sandbox --disable-gpu \
  --screenshot=/tmp/ai-chat.png \
  --window-size=1280,800 \
  "http://127.0.0.1:5176/"

# 3. ดูผล — ควรเห็น: จจี้ avatar + "เข้าสู่ระบบด้วย Google" + "เฉพาะบัญชี peachtukta1014@gmail.com"

# 4. Stop server
kill $(lsof -ti:5176)
```

## Run (human path)

```bash
cd apps/ai-chat
npm run dev   # → http://localhost:5173
```

## Gotchas

- **Login page render ครบโดยไม่มี `.env.local`** — Google OAuth button แสดง แต่กดไม่ได้ในสภาพ headless (ต้องมี Firebase keys + browser จริง)
- **ต้องใช้ `--host 0.0.0.0`** — `npm run dev` ไม่มี flag นี้ทำให้ chromium เข้าไม่ได้
- **Whitelist check** อยู่ใน Firestore `systemConfig/adminWhitelist` — headless ตรวจ UI เท่านั้น
- **Flash (จจี้) ต้องการ** `VITE_FIREBASE_*` + Cloud Function running — ใน dev mode ไม่ได้เชื่อม

## Troubleshooting

| อาการ | สาเหตุ + วิธีแก้ |
|-------|-----------------|
| หน้าขาว / ดำ ใน screenshot | ลืม `--host 0.0.0.0` หรือ sleep น้อยไป |
| `EADDRINUSE :5176` | `kill $(lsof -ti:5176)` |
