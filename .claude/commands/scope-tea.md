# Scope Guard — tea (ชินชา Tea POS)

> AGENTS.md เต็มอยู่ที่ `apps/chincha-tea/AGENTS.md` — อ่านก่อนทุกครั้ง
> เอกสารนี้เพิ่มเฉพาะ **ข้อห้ามชัดเจน + gotchas ที่ไม่อยู่ใน AGENTS.md**

## ห้ามแตะ ❌
- `apps/seafood-pos/`
- `apps/webhook-core/` (ยกเว้น `src/tea/` ถ้างานเกี่ยว LINE ชา)
- `apps/ai-chat/`
- `apps/webhook-core-scheduled/` (ยกเว้น scope=scheduled)
- `.github/workflows/`

## ตรวจสุขภาพก่อน commit
```bash
npm run build --workspace=chincha-tea
```
(ไม่มี smoke-test แยก — build ผ่าน = พร้อม deploy)

## Gotchas สำคัญ
- **i18n 3 ภาษา**: แก้ข้อความ UI → ต้องเพิ่มใน `i18n.js` (th), `my.js` (พม่า), `en.js` ทั้ง 3 พร้อมกัน
- **dateKey ชา**: `Asia/Bangkok` เสมอ — `teaOrders` collection ใช้ `dateKey` ไม่ใช่ timestamp UTC
- **แยก App ID**: `VITE_FIREBASE_APP_ID` ของชาต่างจากกุ้ง — อย่า copy .env ข้ามแอป
- **i18n key**: ถ้าเพิ่ม key ใหม่แต่ไม่มีใน `my.js` → พนักงานพม่าเห็นข้อความว่างหรือ key ดิบ
