# CHANGELOG — seafood-pos

บันทึกการเปลี่ยนแปลงของแอปโกอ้วนซีฟู้ด (Shrimp POS)  
รูปแบบ: `วันที่ | PR | รายละเอียด`

---

## 2026-06

### 2026-06-21 | PR #312
**fix: voice record บันทึกครั้งเดียว → ออเดอร์ขึ้นสองรายการ**
- `src/hooks/useVoice.js` — เพิ่ม `flushedRef` guard ป้องกัน `flushTranscript` ถูกเรียกซ้ำจาก `stop()` + `rec.onend`

### 2026-06-21 | PR #311
**fix: smoke-test เพิ่ม assertions สำหรับ riverDefaultToProduct full-phrase**
- `scripts/smoke-test.mjs` — เพิ่ม 3 assertions: 'กุ้งแม่น้ำกลาง' → 'กุ้งกลาง', 'กุ้งแม่น้ำใหญ่' → 'กุ้งใหญ่', 'กลาง' → 'กุ้งกลาง'

### 2026-06-19 | PR #288
**fix: อัปเดต smoke-test paths หลัง webhook-core refactor (PR #283)**
- `scripts/smoke-test.mjs` — อัปเดต 35 `requireWebhook` / `fs.readFileSync` paths
  - `seafood-notify/`: shrimpBillRender, shrimpBillTemplateRows, shrimpBillPreRender, shrimpLinePush, instantLineNotify
  - `seafood-oa/`: shrimpLineWebhookRouter, parseLineOrder, shrimpLineIntent, shrimpGroupLineWebhook, shrimpGroupKeyboard, shrimpLineCustomerLink, shrimpLinePendingLink, parseDeliveryDate, shrimpPaymentSlip, shrimpLiffMessaging, provisionShrimpLiff, verifyLineLiffToken, shrimpDirectLineWebhook
  - `tea/`: teaDailySummary
- CI "Verify Shrimp POS" ผ่านอีกครั้ง (เดิมติด 9 ENOENT / Cannot find module)

### 2026-06-19 | PR #283–284
**refactor: ย้ายไฟล์ seafood-oa ไปโฟลเดอร์แยกใน webhook-core (ไม่มีการเปลี่ยนแปลงฝั่ง frontend)**
- ไม่มี UI/logic เปลี่ยนแปลงในแอปกุ้ง
- ดู CHANGELOG ฝั่ง webhook-core สำหรับรายละเอียด

---

> รายละเอียด system-wide และ webhook ดูได้ที่ [docs/AGENT_CHANGELOG_TH.md](../../docs/AGENT_CHANGELOG_TH.md)
