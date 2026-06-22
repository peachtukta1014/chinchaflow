# CHANGELOG — webhook-core

บันทึกการเปลี่ยนแปลงของ Cloud Functions (LINE Bot + AI Agent)  
รูปแบบ: `วันที่ | PR | รายละเอียด`

---

## 2026-06

### 2026-06-22 | dev/ai-fix-agent-loop-completion
**fix: agent loop นิ่งกลางทาง — บังคับ tool จนกว่างานจบจริง**
- `src/shared/agentTools.js` — `runAgentLoop`: เลิกเชื่อ `finish_reason` ของโมเดล เปลี่ยนมาใช้ flag `taskCompleted` ที่ระบบเซ็ตเอง (เฉพาะ `commit_and_pr` คืน ✅ หรือเรียก `report_no_action_needed`)
  - บังคับ `tool_choice:'required'` ทุกรอบ (`forceTools = !taskCompleted`) ไม่ใช่แค่ iteration แรก — กันโมเดลพิมพ์ tool call เป็น text เปล่าๆ ตั้งแต่รอบ 2
  - ถ้าโมเดลตอบ text ทั้งที่ยังไม่ taskCompleted → push คำเตือนแล้ววน loop ต่อ ไม่ return ทันที
  - สาเหตุเดิม: บังคับ tool แค่รอบแรก รอบหลังเป็น `auto` → `finish_reason === 'stop'` ทำให้ loop คิดว่างานจบ; เคยแก้ด้วยสลับ AGENT_MODEL แต่กลับมาเมื่อสลับโมเดลคืน
- `src/shared/agentTools.js` — เพิ่ม tool `report_no_action_needed` (ขอดูข้อมูล/ต้องถามเพิ่ม/มีอยู่แล้ว) + comment กัน regression เหนือ `AGENT_MODEL`
- `src/shared/progressTracker.js` — เพิ่ม `appendRunLog()` เขียน log ทุก iteration ลง `agentRunLogs/{requestId}/steps` (ไม่มี TTL) เพื่อตรวจย้อนหลัง

### 2026-06-21 | PR #316
**fix: จีจี้ (ai-chat) รู้จักขอบเขตตัวเอง — เพิ่ม ❌ section + แก้ error response**
- `src/aiChatAgent.js` — root scope system prompt: เพิ่ม "❌ ทำไม่ได้ใน ai-chat" (/auto-shrimp, /auto-tea ฯลฯ คือ Claude Code skills ไม่ใช่คำสั่งแชท · ดู logs real-time ไม่ได้ · deploy เองไม่ได้)
- `src/aiChatAgent.js` — catch block: ส่ง `reply` key แทน `error` key → PWA แสดงข้อความไทยได้แทนที่จะขึ้น "ไม่สามารถติดต่อ AI Server"
- `JIIJI.md` — ลบ tools ที่ไม่มีจริง (trigger_deploy, get_skill), เพิ่ม "❌ ทำไม่ได้" table, Skills section ระบุชัดว่าใช้ใน Claude Code/Cursor เท่านั้น

### 2026-06-21 | PR #312
**fix: LINE OA DM "กุ้ง2โล" → บันทึกตาม defaultRiverSize อัตโนมัติ**
- `src/seafood-oa/shrimpLineOrderHandler.js` — `tryCompleteOrder`: item.product === 'กุ้ง' (bare) ใน DM → resolve ผ่าน `resolveRiverDefaultProduct` → effectiveItems ด้วยขนาดที่ถูก

### 2026-06-21 | PR #311
**fix: riverDefaultToProduct รองรับ 'กุ้งแม่น้ำกลาง' (full-phrase)**
- `src/seafood-oa/customerRiverDefault.js` — strip prefix 'กุ้งแม่น้ำ' + 'กุ้ง' ก่อน SIZE_ALIASES lookup

### 2026-06-20 | PR #296
**docs: อัปเดต PEACH_WORKING_STYLE_TH.md — ตัวตนพีช + stack ปัจจุบัน + protocol**
- เพิ่มบริบทพีช: 4 เดือน, 60,000 บรรทัด, ความรู้ศูนย์, ทำคนเดียว, มือถือ 100%
- เพิ่มตาราง "ทำได้เลย vs รอยืนยัน"
- อัปเดต stack ปัจจุบัน (ลบ Cursor/Slack, เพิ่ม DeepSeek v4 + ai-chat PWA)

### 2026-06-20 | PR #295
**feat: Layer 1 อ่านกฎ repo + สไตล์พี่พีช จาก GitHub ก่อนทุก session**
- `aiChatAgent.js` — เพิ่ม `fetchChatAgentDocs()` ดึง 3 ไฟล์จาก GitHub live
  - `AGENTS.md` — กฎ monorepo + กฎเฉพาะแต่ละแอป
  - `docs/PEACH_WORKING_STYLE_TH.md` — สไตล์พี่พีช (มือถือ, ภาษาพูด, ทบทวนก่อนลงมือ)
  - `docs/AGENT_HANDBOOK_TH.md` — แผนที่ repo + คู่มือ agent
  - cache 10 นาที ไม่กระทบ latency

### 2026-06-20 | PR #294
**feat: aiWorkflowAgent เลือก Flash/Pro อัตโนมัติตามความซับซ้อนของงาน**
- `aiWorkflowAgent.js` — เปลี่ยนจาก `deepseek/deepseek-chat` เป็น v4 Flash + v4 Pro
  - Round 1 (เลือกไฟล์): Flash เสมอ + ประเมิน `complexity: simple|complex`
  - Round 2 (เขียนโค้ด): Flash ถ้า simple/≤3 ไฟล์, Pro ถ้า complex
  - reply บอกพี่ว่าใช้ model ไหน

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
