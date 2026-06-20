# CHANGELOG — webhook-core

บันทึกการเปลี่ยนแปลงของ Cloud Functions (LINE Bot + AI Agent)  
รูปแบบ: `วันที่ | PR | รายละเอียด`

---

## 2026-06

### 2026-06-20 | PR #293
**feat: AI แปลภาษาชาวบ้านเป็น technical spec — ไม่ต้องรู้ศัพท์โปรแกรมเมอร์**
- `aiChatAgent.js` — แทน `isCodeAction()` keyword check ด้วย `classifyAndTranslate()` (flash model)
  - วิเคราะห์ intent + หา scope อัตโนมัติ (tea/seafood/webhook/root)
  - แปลภาษาชาวบ้าน → technical description ส่งต่อ `aiWorkflowAgent`
  - fallback เป็น chat ถ้าไม่แน่ใจ (ปลอดภัย)
  - เพิ่ม timeout 120s, memory 512MB
- `aiWorkflowAgent.js` — เพิ่ม `force` param ใน `handleCodeAction` — ข้าม isCodeAction เมื่อ classifier ยืนยันแล้ว

### 2026-06-20 | PR #291
**feat: รับออเดอร์สั้นในกลุ่ม LINE — ชื่อ+เลข ไม่ต้องมีคำว่ากุ้ง/หน่วย**
- `seafood-oa/customerRiverDefault.js` — ลบ `if (groupId) return null` → lookup `defaultRiverSize` ด้วย customerName ในกลุ่มได้
- `seafood-oa/shrimpLineOrderHandler.js` — `pending`+groupId → auto-resolve ด้วย defaultRiverSize
  - เจอ customer → บันทึกออเดอร์ทันที / ไม่เจอ → เงียบ (ไม่ถามขนาด)
  - riverPending ในกลุ่มไม่มี default → เงียบ; items empty → เงียบ
- `seafood-oa/shrimpGroupLineWebhook.js` — `if (result.reply)` guard ก่อน lineReply

### 2026-06-19 | PR #289
**fix: แก้ font path ใน shrimpBillRender หลัง ย้ายไป seafood-notify/**
- `seafood-notify/shrimpBillRender.js` — `FONT_DIR` เปลี่ยนจาก `../assets/fonts` → `../../assets/fonts`

### 2026-06-19 | PR #288
**feat: 3-tier model — Flash/Pro/Vision (DeepSeek V4)**
- `aiChatAgent.js` — แทน `DEFAULT_MODEL` ด้วย 3-tier อัตโนมัติ
  - `FLASH_MODEL = 'deepseek/deepseek-v4-flash'` — แชททั่วไป
  - `PRO_MODEL = 'deepseek/deepseek-v4-pro'` — โค้ด / วิเคราะห์
  - `VISION_MODEL = 'openai/gpt-4o-mini'` — มีรูปแนบ (คงเดิม)
- เพิ่ม `isCodeRelated()` ครอบคลุม deploy, pr, branch, firebase, วิเคราะห์
- เพิ่ม `pickModel(text, {imageBase64})` — เลือก tier อัตโนมัติ

### 2026-06-19 | PR #287
**feat: อัปเดต AI persona → เลขาส่วนตัวพีช + รองรับ image vision**
- `aiChatAgent.js` — เปลี่ยน persona จาก "เด๊ฟ" เป็น "เลขา" (เลขาส่วนตัวพีช เพื่อนคู่คิด รู้ใจ)
- เพิ่ม system prompt สรุป-ก่อนรับหน้าที่ (หัวข้อ → รายละเอียด → ✅/⚠️/❌ → แนะนำ)
- เพิ่ม `VISION_MODEL = 'openai/gpt-4o-mini'` สำหรับ message ที่มีรูปแนบ
- `callOpenRouter()` รองรับ multimodal content array เมื่อมี `imageBase64`
- `aiChatAgentHttp` รับ `imageBase64` จาก request body ส่งต่อไป OpenRouter

### 2026-06-19 | PR #286
**feat: เพิ่มคำสั่ง "แอด uid" ใน LINE Bot ชา**
- `tea/teaDailySummary.js` — เพิ่ม `ADD_UID_CMD` regex + `classifyTeaLineCommand` คืน `'add_uid'`
- `tea/teaWebhook.js` — handler `add_uid` เพิ่ม userId เข้า `config/teaLine.notifyUserIds`
- อัปเดต `HELP_TEXT` แสดงคำสั่งใหม่

### 2026-06-19 | PR #285
**fix: บันทึก line_messages แม้ groupId ไม่ตรง (แก้ chicken-and-egg)**
- `tea/teaWebhook.js` — เพิ่ม `line_messages.add()` ก่อน `continue` ในกรณีกลุ่มไม่ตรง
- ทำให้ปุ่ม "📥 ดึง Group ID" ใน admin panel ดึง groupId ได้ครั้งแรก

### 2026-06-17 | PR #284
**fix: ย้าย prepareOrderInput.js ไป seafood-oa/ + แก้ paths ใน aiWorkflowAgent**
- `seafood-oa/prepareOrderInput.js` — ย้ายมาจาก `src/` root (แก้ deploy failure)
- `aiWorkflowAgent.js` — อัปเดต SCOPE_FILE_TREE ให้ชี้ paths ใหม่ 4-โฟลเดอร์

### 2026-06-17 | PR #283
**refactor: แยก webhook-core/src/ เป็น 4 โฟลเดอร์ตาม scope**
- `seafood-oa/` — LINE webhook กุ้ง + parser + summary
- `seafood-notify/` — instant notify กุ้ง
- `tea/` — LINE webhook ชา + daily summary
- `shared/` — lineUtils, webhookDedup (ใช้ร่วม)

---

> รายละเอียด system-wide ดูได้ที่ [docs/AGENT_CHANGELOG_TH.md](../../docs/AGENT_CHANGELOG_TH.md)
