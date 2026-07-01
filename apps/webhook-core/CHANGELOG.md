# CHANGELOG — webhook-core

บันทึกการเปลี่ยนแปลงของ Cloud Functions (LINE Bot + AI Agent)  
รูปแบบ: `วันที่ | PR | รายละเอียด`

---

## 2026-07

### 2026-07-01 | fix: Pro Agent audit — WIP PR หายเงียบ + patch_file uniqueness
- `src/shared/agentTools.js` — เก็บ PR URL จาก emergency commit (ตอนชน MAX_ITERATIONS) ใส่ใน error message แทนการทิ้งไปเฉยๆ
- `src/aiWorkflowAgent.js` — ดึง PR URL จาก error message มาแนบในข้อความที่ส่งกลับพีชตอน isMaxIter แทนข้อความทั่วไปที่กลบข้อมูลนี้ไป
- `src/shared/toolExecutors.js` — `patch_file` เช็ค occurrence ของ `find` ก่อน replace ถ้าซ้ำ >1 จุด → ปฏิเสธ (กันแก้ผิดจุดแบบเงียบๆ)
- `src/shared/toolDefinitions.js` — อัปเดต description `patch_file` ให้บอกเรื่อง uniqueness ล่วงหน้า
- `PRO.md` — sync tool param names ให้ตรงโค้ดจริง + แก้ MAX_ITERATIONS=30/SUMMARY_CHECKPOINT=9 ที่ค้างเป็น 22/7
- **ผลกระทบ**: พีชจะไม่พลาดเห็น WIP PR ที่ Pro เปิดไว้ก่อนชนเพดานรอบอีกต่อไป + Pro ปลอดภัยขึ้นตอน patch ไฟล์ที่มี pattern ซ้ำ

### 2026-07-01 | feat: Scope-Level Error Pointer + Post-Validation Schema (Flash)
- `src/shared/progressTracker.js` — เพิ่ม `writeLastRunStatus(scope, {...})` เขียน `systemConfig/lastRunByScope` (merge ต่อ scope)
- `src/aiWorkflowAgent.js` — เรียก `writeLastRunStatus` คู่กับ `writeResult` ทั้ง success/error path
- `apps/webhook-core/scripts/fail-pro-agent.cjs` — เขียน pointer เพิ่มตอน Pro crash กลางคัน
- `src/flash/flashContext.js` — เพิ่ม `loadLastExecutionStatus(scope)`
- `src/aiChatAgent.js` — เช็ก pointer ก่อน classify (เฉพาะ error ที่ไม่เก่าเกิน 6 ชม. — `LAST_RUN_STALE_MS`)
- `src/flash/flashTriggers.js` — `classifyAndTranslate` รับ `lastRunStatus` เพิ่ม + เพิ่ม `isValidTaskSpec()` post-validation ก่อนปล่อยเป็น code-action (schema ไม่ครบ → fallback `chat`)
- **ผลกระทบ**: Flash รู้บริบทว่ารอบก่อนของ scope นี้พังเพราะอะไรก่อนสั่งงานซ้ำ + กัน Task Brief ที่ schema พังหลุดไปถึง Pro

### 2026-07-01 | feat: Flash Code Analysis Loop — อ่านโค้ดจริงก่อนสรุป Task Brief
- `src/flash/flashAnalysisLoop.js` (ใหม่) — read-only agentic loop: `read_file`/`list_files`/`search_code`/`finalize_task_brief`, `MAX_ITERATIONS=6`, ผูก `GH_PAT_READ` เท่านั้น
- `src/aiChatAgent.js` — แทนที่ "verify files_hint" (เช็กแค่ path) ด้วย `runFlashAnalysisLoop()` ก่อนสร้าง Task Brief จริง — non-blocking, fallback ไป taskSpec เบื้องต้นถ้า error/ไม่มี key/เกินรอบ
- **ผลกระทบ**: Task Brief + confirmationMessage ที่พีชเห็นตอน "พิมพ์ไฟเขียว" มาจากการอ่านโค้ดจริงแล้ว ไม่ใช่แค่เดาจากบทสนทนา ลดโอกาส Pro เสีย iteration เพราะ context ผิด — Pro ยังคง `read_file`/`list_files`/`search_code`/`patch_file`/`write_file` วิเคราะห์เองอีกชั้นได้เสมอ (ไม่เปลี่ยนแปลง)

### 2026-07-01 | tune: Pro Agent loop ceiling + recurring checkpoint + token limit
- `src/shared/agentTools.js` — `MAX_ITERATIONS` 30 → 22, `SUMMARY_CHECKPOINT` (ครั้งเดียว) → `CHECKPOINT_INTERVAL=7` ซ้ำทุก 7 รอบผ่าน `isCheckpointRound()`, `max_tokens` ของ tool-loop 4096 → 6144
- **ผลกระทบ**: ลด token cost/ความเสี่ยง runaway ของงานทั่วไป โดยยังเผื่อ buffer พอสำหรับงานซับซ้อนหลายไฟล์ (~18-20 รอบจริง) checkpoint ที่เกิดซ้ำยังคง `continue` ทำงานต่อทุกครั้ง ไม่หยุดนิ่ง

### 2026-07-01 | fix: Flash path verification + Pro auto-changelog (M1+M2)
- `src/aiChatAgent.js` — M1: เพิ่ม `fetchRepoFiles(GH_PAT_READ, hintPaths)` ตรวจ files_hint paths หลัง classify, แนบ warning ใน taskBrief ถ้าไม่พบ (non-blocking)
- `src/shared/toolExecutors.js` — M2: auto-changelog entry ตอนนี้รวม commit_msg + pr_body snippet + sections อาการ/รายละเอียด/ไฟล์/branch

### 2026-07-01 | fix: get_skill enum + skillPaths — เพิ่ม scope-* และ run-* (Pro Agent)
- `src/shared/toolDefinitions.js` — get_skill enum: เพิ่ม scope-seafood, scope-tea, scope-webhook, scope-root, scope-scheduled, run-seafood-pos, run-chincha-tea, run-webhook-core, run-ai-chat
- `src/shared/toolExecutors.js` — skillPaths map: เพิ่ม 4 run-* entries ชี้ไปที่ `apps/*/.claude/skills/run-*/SKILL.md`
- **ผลกระทบ**: Pro สามารถเรียก `get_skill("scope-seafood")` และ `get_skill("run-seafood-pos")` ได้จริงแล้ว — ขั้นตอน verify ก่อน commit ทำงานได้ครบ

### 2026-07-01 | feat: Flash Technical Translator + Task Brief v2
- `src/flash/flashTriggers.js` — classifyAndTranslate: role ใหม่ "Technical Translator & Project Director", schema ใหม่ (target_behavior, logic_constraints, files_hint {path,fn}[], diff_expectation)
- `src/flash/flashTriggers.js` — buildTaskBrief: format ใหม่ structured sections (🎯 งาน → ▸ Target Behavior → ▸ Logic Constraints → ▸ ไฟล์เป้าหมาย → ▸ สิ่งที่ต้องเปลี่ยน), backward compat กับ string[] เก่า

### 2026-07-01 | fix: AI agent safety — 4 จุดเสี่ยงจาก audit
- `src/aiChatAgent.js` — ข้อ 2: สลับ clearResult ให้รันหลัง res.json (ป้องกันผลงาน Pro หายถ้า client หลุด)
- `src/aiChatAgent.js` — ข้อ 5A: ย้าย clearPendingAction หลัง dispatchToProAgent สำเร็จ (ถ้า dispatch fail brief ยังอยู่ retry ได้)
- `src/aiWorkflowAgent.js` — ข้อ 4: เพิ่ม file list ใน system prompt จาก 25 → 50 ไฟล์
- `src/shared/progressTracker.js` — ข้อ 3: เพิ่ม `search?` ใน token schema comment

---

## 2026-06

### 2026-06-30 | feat: Flash Code Reader — Flash อ่านโค้ดล่วงหน้าก่อน dispatch ให้ Pro
- `src/flash/flashContext.js` — เพิ่ม `fetchRepoFiles(pat, filePaths)` อ่าน GitHub API (raw) สูงสุด 5 ไฟล์ × 3,000 chars — ใช้ `GH_PAT_READ` (read-only PAT)
- `src/flash/flashTriggers.js` — `buildTaskBrief()` รับ `fileContents` param ที่ 3 แนบโค้ดที่ Flash อ่านล่วงหน้าเข้า Task Brief
- `src/aiChatAgent.js` — code-action flow เรียก `fetchRepoFiles` ก่อน dispatch — ถ้า `GH_PAT_READ` ไม่มี fallback เป็น `{}` ไม่ error
- `.github/workflows/deploy-functions.yml` — เพิ่ม `GH_PAT_READ` ใน env inject

### 2026-06-29 | fix: Pro Agent ค้าง 20+ นาที + เพิ่ม max iterations
- `src/shared/agentTools.js` — AbortController 5 นาที บน OpenRouter fetch; MAX_ITERATIONS 15→30, SUMMARY_CHECKPOINT 8→25
- `src/shared/agentTools.js` — เพิ่ม `AbortController` + timeout 5 นาที บน `fetch` ไปยัง OpenRouter ใน `callOpenRouterWithTools`; ถ้า DeepSeek ไม่ตอบใน 5 นาที throw error ชัดเจนแทนการค้างไม่มีกำหนด

### 2026-06-28 | fix: sync-agent-docs.cjs เขียน projectTree ด้วย + sync-project-tree.yml ใช้ Service Account
- **อาการ:** Knowledge tab → Project Tree ว่างตลอด — `systemConfig/projectTree` ไม่มีข้อมูลใน Firestore
- **แก้:** `scripts/sync-agent-docs.cjs` — เพิ่ม write `systemConfig/projectTree` (tree field) ควบคู่ agentDocs ใน `Promise.all`
- **แก้:** `.github/workflows/sync-project-tree.yml` — แทน curl+GH_PAT ด้วย Service Account + `node scripts/sync-agent-docs.cjs`

### 2026-06-28 | fix: SyntaxError ใน aiWorkflowAgent.js — escape backtick ใน template literal
- **อาการ:** Pro Agent รัน `run-github-agent.mjs` พัง `SyntaxError: Unexpected identifier 'docs'` ที่ line 393 — ทุก workflow trigger ล้มเหลวทันที
- **สาเหตุ:** `buildAgentSystemPrompt` return template literal (backtick) ที่มี backtick `` ` `` ปนอยู่ใน body (lines 393, 395, 396) โดยไม่ escape → Node.js ปิด template ก่อนกำหนด → syntax error
- **แก้:** `src/aiWorkflowAgent.js` lines 393-396 — escape backtick เป็น `\`` ทุกตัวในส่วนที่เป็น markdown code span
- ถ้าพัง: `node --check apps/webhook-core/src/aiWorkflowAgent.js` ตรวจ syntax

### 2026-06-28 | (branch: claude/test-coverage-analysis-67owag)
**feat: จีจี้ค้นเว็บได้ (on-demand web search) + แก้ prompt + JIIJI.md**
- `src/flash/flashModels.js` — เพิ่ม `SEARCH_MODEL = 'deepseek/deepseek-chat'` + `callOpenRouterForWebSearch()` (OpenRouter web plugin)
- `src/aiChatAgent.js` — two-model web search flow: Flash signal `[WEB_SEARCH: query]` → deepseek-chat ค้นเว็บ → Flash ตอบอีกรอบ
- `src/flash/flashPrompts.js` — แก้คำอธิบาย AI tools: พี่ซี (Claude Code) ยังมีอยู่ (session แยก), เอาแค่ Cursor Cloud Agent ออก
- `JIIJI.md` — ลบ GH_PAT fallback ออก (security: Flash ใช้ GH_PAT_DISPATCH เท่านั้น)

**feat: เพิ่ม PROJECT_STRUCTURE + AGENT_CHANGELOG เข้า agentDocs sync และ Flash context**
- `scripts/sync-agent-docs.cjs` — เพิ่ม `docs/PROJECT_STRUCTURE.md` + `docs/AGENT_CHANGELOG_TH.md` ใน sync list
- `src/flash/flashContext.js` — เพิ่มสองไฟล์นี้ใน `fetchChatAgentDocs()` เพื่อให้จีจี้รู้โครงสร้าง repo + changelog ล่าสุดทุก request

### 2026-06-28 | PR #391
**fix: แก้ description exec_command — relative path + GitHub Actions runner**
- `src/shared/toolDefinitions.js` — แก้ description `exec_command` จาก "Cloud Functions container" เป็น "GitHub Actions runner มี repo checkout เต็ม"
- เพิ่มกฎชัดเจน: ใช้ relative path เสมอ (ห้ามขึ้นต้น `/`)
- แก้ปัญหา AI รัน `node /apps/seafood-pos/scripts/smoke-test.mjs` แทน `node apps/...`

### 2026-06-28 | PR #379
**fix: bump X-Notify-Rev '4' แก้ 401 Sync Agent Docs step**
- `index.js` — `X-Notify-Rev` '3' → '4' บังคับ Firebase redeploy `deployNotifyHttp` ดึง `.env` ใหม่
- สาเหตุ 401: re-run workflow → Firebase "No changes detected" → skip redeploy → token เก่า
- ถ้าพังอีก: bump X-Notify-Rev ขึ้นอีก อย่า re-run workflow เดิม

### 2026-06-24 | claude/new-session-358ebr
**security: แยก GH_PAT_DISPATCH (dispatch-only) + lock GH_PAT ออกจาก Flash (PR-B)**
- `aiChatAgent.js` — runWith secrets เพิ่ม `GH_PAT_DISPATCH`; dispatch ใช้ `process.env.GH_PAT_DISPATCH` แทน `GH_PAT`
- `index.js` — `deployNotifyHttp` เพิ่ม `runWith({ secrets: ['GH_PAT'] })` (auth จาก Secret Manager)
- `deploy-functions.yml` — ลบ `GH_PAT` + `OPENROUTER_API_KEY_PRO` ออกจาก `.env` ร่วม
- ผล: Flash มีแค่ OPENROUTER_API_KEY + GH_PAT_DISPATCH (dispatch only) — ไม่มี repo write
- **ต้องเพิ่มใน Secret Manager:** `GH_PAT` (ค่าเดียวกับ GitHub Secret) ไม่งั้น deploy ล้ม

### 2026-06-24 | claude/new-session-358ebr
**security: Flash เลิกอ่าน GitHub ตรงๆ — อ่าน docs จาก Firestore (PR-A)**
- `aiChatAgent.js` — `loadAgentDocs()` อ่าน `systemConfig/agentDocs`; `fetchCodeMetrics/fetchJiijiDef/fetchChatAgentDocs` เลิกยิง GitHub API (ไม่รับ ghPat)
- `index.js` — `deployNotifyHttp` รับ action `agent_docs` เก็บ docs map ใน Firestore
- `.github/workflows/sync-project-tree.yml` — เพิ่ม workflow_dispatch + step sync 5 ไฟล์เข้า Firestore
- ผล: Flash ไม่ใช้ GH_PAT อ่าน repo อีก (เหลือแค่ dispatch); หลัง deploy ต้อง trigger sync workflow 1 ครั้ง populate agentDocs

### 2026-06-23 | claude/new-session-358ebr
**feat: Flash CF อ่าน `OPENROUTER_API_KEY` จาก Google Cloud Secret Manager**
- `src/aiChatAgent.js` — `aiChatAgentHttp` เพิ่ม `secrets: ['OPENROUTER_API_KEY']` ใน `runWith` → Firebase mount key จาก Secret Manager ตอน runtime
- `.github/workflows/deploy-functions.yml` — ลบ `OPENROUTER_API_KEY` ออกจาก `.env` (ไม่ผ่าน GitHub Secrets แล้ว); `OPENROUTER_API_KEY_PRO` ยังอยู่ที่ GitHub Secrets สำหรับ Pro agent
- ผล: Flash key อยู่ที่ Google Cloud Secret Manager, Pro key อยู่ที่ GitHub — isolation แยกที่เก็บจริง

### 2026-06-23 | dev/ai-docs-cleanup
**docs+cleanup: อัปเดตเอกสารตาม architecture ใหม่ + ลบไฟล์ตาย**
- ลบ `src/seafood-notify/notify.js` — LINE Notify API (เลิกบริการ 2025-03-31), ไม่มีใคร import, ไฟล์เดียวที่ใช้ axios
- `src/aiWorkflowAgent.js` — เอา `notify.js` ออกจาก SCOPE_FILE_TREE
- `src/aiChatAgent.js` — อัปเดต header doc + system prompt: จาก "สวมหมวกนักพัฒนา process เดียว 60วิ" → "ส่งงานต่อทีม Pro เบื้องหลังบน GitHub Actions"
- `docs/ARCHITECTURE_TH.md`, `docs/AGENT_HANDBOOK_TH.md` — ตาราง function + AI agent แยก 2 ฝ่าย

### 2026-06-23 | dev/ai-arch-gh-actions-trigger (PR #351)
**feat: แยก Flash CF ↔ Pro GitHub Actions ผ่าน repository_dispatch (isolation 100%)**
- `src/aiChatAgent.js` — code-action + quick trigger → `dispatchToProAgent()` ส่ง `repository_dispatch (ai-code-action)` แล้ว return ทันที; เลิก `require('./aiWorkflowAgent')` ใน Flash CF
- เพิ่ม `.github/workflows/ai-workflow-trigger.yml` — รับ dispatch → รัน Pro loop (`OPENROUTER_API_KEY_PRO` + `GH_PAT`), timeout 30 นาที (ไม่ติด 540s CF)
- เพิ่ม `scripts/run-github-agent.mjs` — รัน `handleCodeActionV2` ใน GH Actions, เขียนผลกลับ Firestore ผ่าน firebase-admin

### 2026-06-23 | dev/ai-arch-split-keys-project-tree (PR #349)
**feat: ลด loop limit 30→15, แยก API key Pro/Flash, sync project tree → Firestore**
- `src/shared/agentTools.js` — `MAX_ITERATIONS` 30→15, `SUMMARY_CHECKPOINT` 15→8 + error message
- `src/aiWorkflowAgent.js` — ใช้ `OPENROUTER_API_KEY_PRO` (fallback `OPENROUTER_API_KEY`)
- `src/aiChatAgent.js` — `loadProjectTree()` อ่าน `systemConfig/projectTree` (cache 5 นาที) inject เข้า system prompt
- `src/index.js` — `deployNotifyHttp` รองรับ `action:'project_tree'` เขียน Firestore
- `.github/workflows/sync-project-tree.yml` — ส่ง tree ไป Cloud Function หลัง commit
- `.github/workflows/deploy-functions.yml` — เพิ่ม `OPENROUTER_API_KEY_PRO` ใน .env

### 2026-06-23 | PR (pending)
**refactor: แยก agentTools.js → 3 ไฟล์ (webhook-core)**
- `src/shared/agentTools.js` — orchestrator: stripDsml + callOpenRouterWithTools + runAgentLoop
- เพิ่ม `src/shared/toolDefinitions.js` — TOOL_DEFINITIONS (10 tools) + constants
- เพิ่ม `src/shared/toolExecutors.js` — fetchRepoFile + executeTool; แก้ isHighRisk context

### 2026-06-23 | dev/ai-confirm-before-code
**feat: Flash ยืนยันความเข้าใจก่อน Pro loop — bullet ทำ/ไม่ทำ + รอ "ทำเลย"**
- `src/aiChatAgent.js` — `classifyAndTranslate`: เพิ่ม `needsConfirmation` + `confirmationMessage` (Thai bullet ✅/❌); max_tokens 400→600
- `src/aiChatAgent.js` — handler: ถ้า `needsConfirmation=true` → reply ด้วย confirmationMessage ทันที ไม่รัน Pro loop; "ทำเลย" → `needsConfirmation=false` → Pro loop ทำงาน

### 2026-06-23 | dev/ai-chat-flash-code-pro
**feat: แชทตอบ → flash, loop เขียนโค้ด → pro (คงเดิม); checkpoint สรุปรอบ 15; MAX_ITERATIONS 15→30**
- `src/aiChatAgent.js` — `pickModel`: non-vision → FLASH_MODEL (v4-flash) แทน PRO_MODEL; อัปเดต comment ให้ชัดว่า flash=แชทตอบพีช, pro=loop เขียนโค้ดใน agentTools.js เท่านั้น
- `src/shared/agentTools.js` — `runAgentLoop`: เพิ่ม SUMMARY_CHECKPOINT=15 (inject user message ขอสรุปก่อนรอบ 15, ไม่ force tool รอบนั้น, รีเซ็ต consecutiveTextOnlyReplies); เพิ่ม MAX_ITERATIONS 15→30 รองรับงานซับซ้อน

### 2026-06-23 | dev/ai-model-consolidation
**refactor: รวมโมเดลแชท+เขียนโค้ดเป็น deepseek-v4-pro ตัวเดียว + harden reasoning_content**
- `src/aiChatAgent.js` — `pickModel`: เลิกแยก flash/pro ตามคีย์เวิร์ด → แชทที่ตอบพีชใช้ v4-pro หมด (รูปยังเป็น gpt-4o-mini); ลบฟังก์ชัน `isCodeRelated` ที่ไม่ถูกใช้แล้ว; `classifyAndTranslate` ยังคงใช้ flash (ตัวจัดเส้นทางเบื้องหลัง ยิงทุกข้อความ ต้องเร็ว)
- `src/shared/agentTools.js` — `runAgentLoop`: harden การส่ง reasoning กลับ — เก็บจาก `reasoning_content`/`reasoning` แล้วส่งกลับทั้ง `reasoning_content` + `reasoning` + `reasoning_details` (กัน OpenRouter routing เปลี่ยนชื่อ field); เพิ่ม diagnostic log ชั่วคราว 1 รอบ/คำสั่ง เช็คว่า field reasoning ชื่ออะไรจริง
- `src/aiWorkflowAgent.js` — ลบ const `FLASH_MODEL`/`PRO_MODEL` ที่เป็น dead code (เหลือจาก V1 pipeline ที่ลบไป PR #327 — loop ใช้ `AGENT_MODEL` จาก agentTools.js อยู่แล้ว)

### 2026-06-22 | dev/docs-sync-structure-jiiji
**docs: sync PROJECT_STRUCTURE.md + แก้ JIIJI.md อ้างอิง Claude Code App ที่ไม่มีแล้ว**
- `docs/PROJECT_STRUCTURE.md` — ลบแถว `aiWorkflowAgentHttp` (ลบใน PR #327); อัปเดต seafood-oa count จาก `~15` → `~36 ไฟล์`; อัปเดต `aiChatAgentHttp` description ให้ตรงสถานะจริง
- `JIIJI.md` — ❌ table: ลบ "เปิด Claude Code App" → "Claude Code CLI remote session"; Skills section: เปลี่ยนหัว "Claude Code App / Cursor IDE" → "Claude Code CLI"; ลบคอลัมน์ "ใช้ใน" ที่ redundant

### 2026-06-22 | dev/ai-fix-reasoning-content-loop
**fix: reasoning_content ไม่ถูกส่งกลับใน multi-turn → OpenRouter 400 + isTransient false-positive**
- `src/shared/agentTools.js` — `runAgentLoop`: เพิ่ม `reasoning_content` (fallback `reasoning`) ใน assistant message push — DeepSeek V4 Pro thinking mode ต้องการ field นี้ทุก turn ไม่งั้น OpenRouter ตอบ `400: reasoning_content in the thinking mode must be passed back`
- `src/aiWorkflowAgent.js` — `handleCodeActionV2`: เพิ่ม `isReasoningContentError` check ก่อน `isTransient` regex เพื่อป้องกัน 400 นี้ถูกแปลผิดว่าเป็น network error แล้ว user เห็น "ลองใหม่" แทน error จริง

### 2026-06-22 | dev/ai-fix-loop-early-exit
**fix: agent loop วนจนครบ 15 รอบเปล่าๆ เมื่อโมเดลพิมพ์ tool call ปลอมซ้ำ**
- `src/shared/agentTools.js` — `runAgentLoop`: เพิ่ม `consecutiveTextOnlyReplies` counter; early exit หลัง 3 รอบติดกัน; warning ใหม่แสดง text ที่โมเดลพิมพ์จริงและบอกว่าต้องใช้ function calling; reset เมื่อ tool_calls สำเร็จ

### 2026-06-22 | dev/ai-fix-json-parse-error
**fix: res.json() ไม่มี error handling ทำให้ Error 500 unexpected end of JSON input ไม่ถูก retry**
- `src/shared/agentTools.js` — `callOpenRouterWithTools`: ห่อ `res.json()` ด้วย try/catch + retry ครั้งเดียว (รอ 2s) เมื่อ JSON parse ล้มเหลว
- `src/aiChatAgent.js` — `callOpenRouter`: ห่อ `res.json()` ด้วย try/catch + throw error ที่อ่านได้

### 2026-06-22 | dev/ai-fix-token-waste-and-stale-docs
**fix: 5 จุดเสีย token/ทรัพยากร + header ภาษาไทยทำแก้โค้ดพัง 100%**
- `src/shared/agentTools.js` — (1) `X-Title` header มี `จีจี้` (ไทย/non-Latin-1) → fetch throw `TypeError` ทันทีก่อนส่ง request → เปลี่ยนเป็น `(Jiji)`; (4) `get_skill` เพิ่ม warning ท้าย return ว่า npm/git/node scripts รันไม่ได้ใน Cloud Functions container
- `src/aiChatAgent.js` — (2) `fetchJiijiDef` slice จาก 2000 → 3500 (คำเตือนอยู่ที่ ~2440); (3) `fetchChatAgentDocs` maxLen 3000/2500/1500 → 6000/5000/5000; (5.1) comment `V1 onRequest fallback` → `Main HTTP endpoint`; (5.2) comment `V2: agentic loop — fallback to V1` → ตรงกับสถานะจริงหลัง PR #327
- `src/aiWorkflowAgent.js` — (3) `fetchAgentDocs` maxLen 4000/3000/2000 → 6000/5000/5000

### 2026-06-22 | dev/ai-fix-architecture-sync
**refactor: ลบ V1 pipeline + dead endpoints ออก ให้เหลือแค่ agentic loop V2 เดียว + retry network**
- `src/aiWorkflowAgent.js` — ลบ V1 ทั้งก้อน (`callOpenRouter`, `extractJson`, `buildFileSelectionPrompt`, `buildFixPlanPrompt`, `applyCodeChanges`, `openPR`, `executeCodeAction`, `handleCodeAction`, `exports.aiWorkflowAgentHttp`); ปรับ catch block `handleCodeActionV2` แยก error 3 ประเภท แทน fallback ไป V1
- `src/aiChatAgent.js` — ลบ `exports.aiChatAgent` (onCall) dead endpoint + เพิ่ม "มีระบบเดียวเท่านั้น" ใน SYSTEM_PROMPTS
- `src/index.js` — ลบ Object.assign `aiWorkflowAgentHttp` + `aiWorkflowStatusHttp`
- `src/shared/agentTools.js` — เพิ่ม auto-retry ครั้งเดียวสำหรับ fetch error + HTTP 429/503

### 2026-06-22 | dev/ai-fix-self-awareness
**fix: จีจี้เข้าใจหน้าที่จริงและรูปแบบการทำงาน 3 ชั้นถูกต้อง + เลิกพูดถึง Claude Code App ที่ไม่มีอยู่แล้ว**
- `src/aiChatAgent.js` — `SYSTEM_PROMPTS.root`: เปลี่ยนทั้งก้อน
  - เพิ่มหัวข้อ "🧠 รูปแบบการทำงานจริงของจีจี้" อธิบาย 3 ชั้น: classify → agentic loop (มี tool) / chat (ไม่มี tool)
  - เปลี่ยน ❌ section: ลบ "ต้องเปิด Claude Code App" (เลิกใช้ไปแล้ว) → แทนด้วย "ไม่มีทางเลี่ยง ไม่มีอีกแอป" + เพิ่ม warning ห้ามแนะนำ Claude Code App/Cursor Cloud เด็ดขาด
  - เพิ่ม docs/PEACH_WORKING_STYLE_TH.md เข้า Scopes/เอกสาร
  - ปรับ 🔐 GH_PAT: ระบุว่าใช้ได้เฉพาะโหมดนักพัฒนา + ห้ามใช้นอกเหนือจากที่พี่สั่ง

### 2026-06-22 | dev/ai-fix-chat-tool-confusion
**fix: classifier ส่ง "ดูโค้ด/ตรวจไฟล์" เข้า code-action + กันจีจี้พิมพ์ tool call ปลอมใน chat mode**
- `src/aiChatAgent.js` — `classifyAndTranslate` system prompt: ขยาย trigger เป็น code-action ครอบคลุม "ดู/อ่าน/ตรวจสอบ/วิเคราะห์ไฟล์หรือโค้ดที่มีอยู่จริง" (เช่น "ตรวจสอบไฟล์ X", "อธิบายว่า Z ทำงานยังไง") — เดิมถูก classify เป็น chat → model ไม่มี tool จริงแต่พิมพ์ tool call เป็น text
- `JIIJI.md` — เพิ่ม warning หลัง tools table: tools ใช้ได้จริงเฉพาะ agentic loop (code-action) ถ้า intent=chat ห้ามพิมพ์ชื่อ tool เป็นข้อความ ให้แจ้งพี่ขอเข้าโหมดตรวจโค้ดก่อน

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
