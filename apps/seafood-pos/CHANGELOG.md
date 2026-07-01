## 2026-07-01 — chore: remove Cursor Cloud Agent artifacts + fix stale doc references (PR #457)

## สรุป

พีชไม่ใช้ Cursor Cloud Agent แล้ว (ย้ายมา Claude Code CLI เต็มตัว) — PR นี้ลบ artifacts ของ Cursor ออก พร้อมตรวจสอบทั้ง repo หาจุดตกหล่นอื่นที่พลาดอัปเดตมาก่อนหน้านี้

## 1) ลบ Cursor Cloud Agent

- ลบ `apps/seafood-pos/.cursor/` และ `apps/chincha-tea/.cursor/` ทั้งโฟลเดอร์ (skills: auto-shrip, deploy-shrimp, ship-shrimp, auto-tea, deploy-tea, ship-tea — ซ้ำกับ `.claude/commands/` ที่ใช้จริงอยู่แล้ว)
- ตัดเนื้อหา Cursor-specific ออกจาก `AGENTS.md` (root) — Slack channels, Peter/พี่เซอ persona สำหรับ Cursor, Cloud Agent Secrets/materialize script ทั้งหมด — **คงเนื้อหาที่ Pro Agent ยังอ่านจริงไว้ครบ** (ก่อนเพิ่มของใหม่, กฎ changelog, เอกสารให้เอเจนต์)
- `apps/seafood-pos/AGENTS.md`, `apps/chincha-tea/AGENTS.md` — เปลี่ยน path `.cursor/skills/*` → `.claude/commands/*` ที่ใช้งานจริงตอนนี้ (ไฟล์เหล่านี้ยังถูก Pro Agent's `fetchAgentDocs()` ดึงมาใช้จริงตาม scope — ไม่ใช่ Cursor-only)

## 2) จุดตกหล่นที่เจอระหว่างตรวจ (กระทบ Pro Agent จริง)

`.skill/scope-root.md` และ `.skill/scope-webhook.md` เป็นไฟล์ live ที่ Pro โหลดผ่าน `get_skill()` — เจอ:
- อ้าง `JIIJI.md`/`.jiiji/` ที่ไม่มีในโค้ดแล้ว (ถูกรวมเข้า `FLASH.md`/`PRO.md` ไปนานแล้ว)
- เลข `MAX_ITER

# CHANGELOG — seafood-pos

บันทึกการเปลี่ยนแปลงของแอปโกอ้วนซีฟู้ด (Shrimp POS)  
รูปแบบ: `วันที่ | PR | รายละเอียด`

---

## 2026-06

### 2026-06-23 | PR (pending)
**refactor: แยก InventoryScreen.jsx เป็น 3 ไฟล์ (1,048 → 3 ไฟล์)**
- `src/screens/InventoryScreen.jsx` — orchestrator: navigation/history state + effects + callbacks
- เพิ่ม `src/screens/StockFilter.jsx` — ฟอร์มรับเข้า live/dead, ในบ่อ, spoilage
- เพิ่ม `src/screens/StockBatchList.jsx` — ล็อตไทม์ไลน์ + ประวัติรับตาย

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
