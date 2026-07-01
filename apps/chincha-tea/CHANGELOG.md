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

# CHANGELOG — chincha-tea

บันทึกการเปลี่ยนแปลงของแอปร้านน้ำชินชา ไม้ขาว (Tea POS)  
รูปแบบ: `วันที่ | PR | รายละเอียด`

---

## 2026-06

### 2026-06-24 | claude/new-session-358ebr
**fix: อัปโหลดรูปรายการประจำร้านไม่สำเร็จ — เพิ่ม storage rule `catalogImages/`**
- อาการ: ใส่รูปให้รายการประจำร้าน (RestockForm) แล้วขึ้น "อัปโหลดไม่สำเร็จ" แม้รูปเล็ก
- สาเหตุ: อัปโหลดไป `catalogImages/{id}.jpg` แต่ `storage.rules` (root) ไม่มี match path → โดน catch-all บล็อก
- แก้: เพิ่ม rule `catalogImages/{fileName}` (signed-in, < 3MB, image only) ใน `storage.rules`; โค้ดแอปไม่เปลี่ยน (มี `compressImageFile` 400×400 อยู่แล้ว)

### 2026-06-19 | PR #285
**fix: กรองรายการออเดอร์สั่งของที่ถูกยกเลิกออกจากหน้า RestockTab**
- `RestockTab.jsx` — เพิ่ม `&& normalizeRestockStatus(r.purchaseStatus) !== 'cancelled'` ใน filter รายการสั่งของ pending ทั้งสองจุด (guard + render)
- ออเดอร์ที่กด "ยกเลิก" จะหายออกจากรายการทันที ไม่โชว์อีก

---

> รายละเอียด system-wide และ webhook ดูได้ที่ [docs/AGENT_CHANGELOG_TH.md](../../docs/AGENT_CHANGELOG_TH.md)
