# Scope Guard — scheduled (cron สรุปยอดชา)

> ไม่มี AGENTS.md ประจำ scope — ใช้ไฟล์นี้เป็นคู่มือหลัก

## แตะได้ ✅
- `apps/webhook-core-scheduled/src/` — cron Cloud Function ทั้งหมด
- `docs/` — changelog + architecture ถ้าจำเป็น

## ห้ามแตะ ❌
- `apps/seafood-pos/`, `apps/chincha-tea/`, `apps/ai-chat/`
- `apps/webhook-core/src/` (อ่านได้ — เฉพาะ `src/tea/teaDailySummary.js` ถ้าต้องการ logic ร่วม แต่ห้ามแก้)

## ตรวจสุขภาพก่อน commit
```bash
node --check apps/webhook-core-scheduled/src/<ไฟล์ที่แก้>.js
```

## Gotchas สำคัญ
- **cron ชั่วโมง**: รันทุกชั่วโมง — logic "ถึงเวลาส่งหรือยัง" ขึ้นอยู่กับ `config/teaLine.scheduledHour` ใน Firestore (ไม่ hardcode)
- **logic ร่วม**: `teaDailySummary.js` อยู่ใน `apps/webhook-core/src/tea/` — ถ้าต้องการแก้ logic สรุป ต้องเปลี่ยน scope เป็น webhook
- **require() เท่านั้น** — CommonJS เหมือน webhook-core ห้ามใช้ `import`
- **ไม่มี build step แยก** — deploy ผ่าน `deploy-functions.yml` trigger `apps/webhook-core-scheduled/**`
