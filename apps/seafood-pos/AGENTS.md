# Agent scope — แอปกุ้ง (seafood-pos)

งานจาก Slack ช่อง `#chincha-shrimp-agent` หรือข้อความที่อ้าง **กุ้ง / shrimp / seafood** ให้ทำงานในโฟลเดอร์นี้เท่านั้น

## ขอบเขต

- โค้ดหลัก: `apps/seafood-pos/`
- อย่าแก้ `apps/chincha-tea/` เว้นแต่ผู้ใช้สั่งชัด
- LINE / Cloud Functions: `apps/webhook-core/` เฉพาะเมื่อสั่ง webhook กุ้ง

## คำสั่งที่ใช้บ่อย

```bash
npm run dev:seafood
npm run build --workspace=seafood-pos
node apps/seafood-pos/scripts/smoke-test.mjs
```

## โปรดักชัน

https://ko-seafood.top

## Firebase

ใช้ `apps/seafood-pos/.env.local` (`VITE_FIREBASE_*`) — `VITE_FIREBASE_APP_ID` ของกุ้ง (ต่างจากชา)

## Skills (เฉพาะแอปนี้)

- `.claude/commands/auto-shrimp.md` — smoke + build อัตโนมัติ ตรวจสุขภาพ (`get_skill("auto-shrimp")`)
- `.claude/commands/ship-shrimp.md` — **ปิดงานกุ้ง:** smoke + build ผ่าน → commit → เปิด PR → รอ merge (`get_skill("ship-shrimp")`) — deploy จริงเกิดหลัง merge `main` ผ่าน `deploy-hosting.yml` อัตโนมัติ
- `apps/seafood-pos/.claude/skills/run-seafood-pos/` — dev server + screenshot + smoke test (`get_skill("run-seafood-pos")`)
- Repo-wide: `.claude/commands/land-it.md` — เปิด/อัปเดต PR (`get_skill("land-it")`)

## ก่อนเพิ่ม CI / automation ใหม่

ถ้าขอ **GitHub Actions CI**, workflow ซ้ำ, หรือเครื่องมือตรวจอัตโนมัติเพิ่ม — อ่าน **`/AGENTS.md` → “ก่อนเพิ่มของใหม่”** แล้วแจ้งผู้ใช้ว่ามี smoke + `auto-shrip` + deploy บน `main` อยู่แล้ว **ไม่ต้องเพิ่ม CI PR** เว้นแต่ผู้ใช้ยืนยันหลังคำเตือน
