# Scope Guard — seafood (โกอ้วน คลังซีฟู้ด)

## แตะได้ ✅
- `apps/seafood-pos/` — ทุกไฟล์ใต้โฟลเดอร์นี้
- `docs/` — อัปเดต AGENT_CHANGELOG_TH.md + ARCHITECTURE_TH.md ถ้าจำเป็น
- `firestore.rules` / `firestore.indexes.json` — ถ้างานต้องการ field/collection ใหม่ (แจ้งในชื่อ commit)

## ห้ามแตะ ❌
- `apps/chincha-tea/` — ร้านชา คนละ codebase
- `apps/webhook-core/` — LINE backend (ยกเว้นได้รับมอบหมายชัดเจน)
- `apps/ai-chat/` — AI Chat PWA
- `apps/webhook-core-scheduled/` — cron ชา
- `.github/workflows/` — CI/CD (แตะเฉพาะถ้า scope=root)

## ตรวจสุขภาพก่อน commit
```bash
node apps/seafood-pos/scripts/smoke-test.mjs   # ต้องผ่านทุก case
npm run build --workspace=seafood-pos           # ถ้าแตะ JSX/JS ใดๆ
```
ใช้ `exec_command` เพื่อรัน — ถ้า smoke fail ให้แก้ก่อน commit เสมอ

## Gotchas สำคัญ
- **customers sync**: แก้รายชื่อลูกค้าใน `constants/customers.js` → ต้องแก้ `apps/webhook-core/src/seafood-oa/shrimpBuiltinCustomers.js` พร้อมกัน (แต่ shrimpBuiltinCustomers.js อยู่นอก scope — ถ้างานนี้ต้องการ แจ้งพีชแยก PR)
- **FIFO stock logic**: `stockService.js`, `saleFifo.js`, `stockBatchUtils.js` — ห้ามเปลี่ยน deduction logic โดยไม่รัน smoke test
- **dateKey**: ใช้ `Asia/Bangkok` เสมอ ไม่ใช่ UTC midnight
- **Firestore**: ไม่มี limit() → OOM — เพิ่ม `.limit(2000)` ทุก collection scan
