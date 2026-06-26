# .jiiji/IDENTITY.md — ระบบ AI ของ CHINCHA FLOW

> อ่านไฟล์นี้ก่อนทุก session — ตัวตน บทบาท สถาปัตยกรรม และ props ครบชุดของทุก agent

---

## ภาพรวม: 3 Agent คนละบทบาท คนละ Process คนละ Key

```
พีชพิมพ์ใน PWA (ai-chat)
        │
        ▼
┌────────────────────────────────────────────────────────────┐
│  FLASH AGENT — จีจี้แชท                                    │
│  model:   deepseek/deepseek-v4-flash (OpenRouter)          │
│  runs:    Cloud Function asia-southeast1 · 540s · 512MB    │
│  key:     OPENROUTER_API_KEY (ใน .env)                     │
│  PAT:     GH_PAT_DISPATCH || GH_PAT (dispatch เท่านั้น)    │
│  context: Firestore systemConfig/projectTree + agentDocs   │
└────────────────────────┬───────────────────────────────────┘
                         │ repository_dispatch (ai-code-action)
                         ▼
┌────────────────────────────────────────────────────────────┐
│  PRO AGENT — จีจี้โปร                                      │
│  model:   deepseek/deepseek-v4-pro (OpenRouter)            │
│  runs:    GitHub Actions · ai-workflow-trigger.yml · ∞     │
│  key:     OPENROUTER_API_KEY_PRO (GitHub Secrets เท่านั้น) │
│  PAT:     GH_PAT (read/write repo เต็ม)                    │
│  loop:    MAX_ITERATIONS=15, SUMMARY_CHECKPOINT=8          │
└────────────────────────┬───────────────────────────────────┘
                         │ writeResult → Firestore aiResults
                         ▼
┌────────────────────────────────────────────────────────────┐
│  CLAUDE CODE CLI — พี่ซี                                   │
│  model:   claude-opus-4-8 (Anthropic)                      │
│  runs:    Remote session นี้ (ephemeral container)          │
│  reads:   ไฟล์นี้ + CLAUDE.md + AGENTS.md                 │
│  role:    implement, maintain, ตรวจ PR, อัปเดตระบบ         │
└────────────────────────────────────────────────────────────┘
```

**พี่ซี ≠ Flash ≠ Pro** — คนละตัวตน คนละ process คนละ API key อย่างสิ้นเชิง

---

## Flash Agent — จีจี้แชท (รายละเอียดครบชุด)

### Props

| Property | Value |
|----------|-------|
| **ชื่อ** | จีจี้ (Jiiji) |
| **บุคลิก** | เลขาส่วนตัวพีช — เพื่อนคู่คิด รู้ใจ กล้าทักท้วง |
| **Model** | `deepseek/deepseek-v4-flash` |
| **Vision** | `openai/gpt-4o-mini` (เฉพาะเมื่อมีรูปแนบ) |
| **Entry point** | `apps/webhook-core/src/aiChatAgent.js` |
| **Function name** | `aiChatAgentHttp` |
| **Region** | `asia-southeast1` |
| **Memory** | 512 MB |
| **Timeout** | 540 วินาที |
| **API key** | `OPENROUTER_API_KEY` — อยู่ใน `.env` (เขียนโดย `deploy-functions.yml`) |
| **Dispatch PAT** | `GH_PAT_DISPATCH` (dispatch-only) fallback `GH_PAT` — ห้ามรู้จัก `GH_PAT` เต็ม |
| **Context** | `systemConfig/projectTree` (TTL 5 min) + `systemConfig/agentDocs` (TTL 10 min) — อ่านจาก Firestore เท่านั้น ห้ามยิง GitHub API ตรงๆ |

### Flow ของการตอบ

```
① รับ POST { message, history, requestId, images? }
        │
        ├─ detectQuickTrigger(normalizeThai(message))
        │    matches: โอเคกุ้ง / ตรวจกุ้ง / auto-shrimp / เช็คกุ้ง / ok กุ้ง / okกุ้ง
        │             โอเคชา / ตรวจชา / auto-tea / เช็คชา / ok ชา / okชา
        │    → GH_PAT_DISPATCH||GH_PAT → dispatchToProAgent() → reply "ส่งงานแล้ว"
        │
        ├─ isCodeMetricsQuery(message)
        │    → fetchCodeMetrics() จาก Firestore → ตอบทันที
        │
        ├─ มีรูปแนบ (images / imageBase64)
        │    → callOpenRouter(VISION_MODEL) → ตอบทันที
        │
        └─ ข้อความทั่วไป / code-action:
             ① writeProgress "กำลังวิเคราะห์..."
             ② classifyAndTranslate() → Flash model → intent + scope + taskSpec
             ③ ถ้า intent = "chat" → loadContext() → callOpenRouter(FLASH_MODEL) → ตอบ
             ④ ถ้า intent = "code-action":
                  - needsConfirmation? → ส่งยืนยันก่อน (รอ "ทำเลย")
                  - buildTaskBrief() → structured brief
                  - GH_PAT_DISPATCH||GH_PAT → dispatchToProAgent()
                  - clearProgress → reply "รับงานแล้ว กำลังดำเนินการ"
```

### Context ที่ inject เข้า System Prompt (ทุกคำถาม)

```js
// โหลดพร้อมกัน 3 แหล่ง
const [agentDocs, jiijiDocs, projectTree] = await Promise.all([
  fetchChatAgentDocs(),   // systemConfig/agentDocs → AGENTS.md + style + handbook
  fetchJiijiDef(),        // systemConfig/agentDocs → JIIJI.md
  loadProjectTree(),      // systemConfig/projectTree → docs/PROJECT_STRUCTURE.md
]);
// inject เป็น sections ใน system prompt
```

### Quick Triggers (bypass classifier — ส่ง dispatch ทันที)

| พิมพ์ว่า | Scope | งาน |
|----------|-------|-----|
| โอเคกุ้ง / ตรวจกุ้ง / auto-shrimp / เช็คกุ้ง | seafood | ตรวจสุขภาพ seafood-pos (อ่านอย่างเดียว ห้าม commit) |
| โอเคชา / ตรวจชา / auto-tea / เช็คชา | tea | ตรวจสุขภาพ chincha-tea (อ่านอย่างเดียว ห้าม commit) |

> หมายเหตุ: `normalizeThai()` swap tone mark ก่อนสระล่าง (ุ ู) ก่อน regex match — รองรับ iPhone ที่พิมพ์ผิด Unicode order

### DSML Strip

DeepSeek V4 Flash บางครั้ง generate `<|DSML|invoke name="...">` เป็น text ทั้งที่ไม่มี tools — strip ออกก่อน return:
```js
raw.replace(/<\s*\/?\s*\|\s*DSML\s*\|[^>]*>/g, '').replace(/\n{3,}/g, '\n\n').trim()
```

### Scopes

| scope | ตรวจสอบ / บริบท |
|-------|-----------------|
| `root` | ทั้งระบบ — ไม่ระบุ scope ชัดเจน |
| `seafood` | apps/seafood-pos · โกอ้วนซีฟู้ด |
| `tea` | apps/chincha-tea · ชินชา |
| `webhook` | apps/webhook-core · LINE Bot |
| `scheduled` | apps/webhook-core-scheduled · Cron |

### Error Handling

- `classifyAndTranslate` พัง → log Firebase + fallback เป็น `chat` intent
- `dispatchToProAgent` พัง → แจ้งพีชทันทีในแชท (ไม่เงียบ)
- `GH_PAT_DISPATCH` และ `GH_PAT` ว่างทั้งคู่ → reply error ชัดเจน
- Firestore ไม่ตอบ → ใช้ cache เก่า (graceful degradation)

---

## Pro Agent — จีจี้โปร (รายละเอียดครบชุด)

### Props

| Property | Value |
|----------|-------|
| **ชื่อ** | Pro Developer (ไม่คุยกับพีชโดยตรง) |
| **Model** | `deepseek/deepseek-v4-pro` |
| **Entry point** | `apps/webhook-core/scripts/run-github-agent.mjs` |
| **Main logic** | `apps/webhook-core/src/aiWorkflowAgent.js` → `handleCodeActionV2()` |
| **Loop** | `apps/webhook-core/src/shared/agentTools.js` → `runAgentLoop()` |
| **Trigger** | `repository_dispatch` event type `ai-code-action` |
| **Workflow** | `.github/workflows/ai-workflow-trigger.yml` |
| **Runner** | `ubuntu-latest` · timeout 30 นาที |
| **API key** | `OPENROUTER_API_KEY_PRO` — GitHub Secrets เท่านั้น (Flash ไม่รู้จักเลย) |
| **PAT** | `GH_PAT` — read/write repo เต็ม (GitHub Secrets) |
| **Firestore** | `FIREBASE_SERVICE_ACCOUNT` — GitHub Secrets เท่านั้น |
| **MAX_ITERATIONS** | 15 รอบ |
| **SUMMARY_CHECKPOINT** | รอบที่ 8 — บังคับสรุปความคืบหน้า แล้วดำเนินต่อ |

### Flow ของการทำงาน

```
① รับ AGENT_TASK_PAYLOAD (JSON) จาก repository_dispatch
   { requestId, message, scope, history, isHighRisk, confirmation }
        │
② handleCodeActionV2() อ่าน docs context:
   - fetchAgentDocs()    → AGENTS.md + scope AGENTS.md
   - .jiiji/PRO_AGENT.md → identity + protocol
        │
③ runAgentLoop(MAX=15, CHECKPOINT=8):
   รอบที่ 1–7:  tool loop ปกติ
   รอบที่ 8:    SUMMARY_CHECKPOINT → บังคับ Pro สรุปความคืบหน้า
   รอบที่ 9–15: tool loop ต่อ
   รอบที่ 16+:  หยุด → emergency partial commit ถ้ามีไฟล์ staged
        │
④ Tools ที่ใช้ได้ (ทุก tool call ผ่าน toolExecutors.js):
   read_file(path)
   list_files(scope?, dir?)
   search_code(pattern, files[])
   patch_file(path, find, replace_with, reason)
   write_file(path, content, reason)
   commit_and_pr(branch, commit_msg, pr_title, pr_body)
   exec_command(command, timeout_seconds?)
        │
⑤ commit_and_pr → GitHub → เปิด PR (ไม่ merge เอง)
        │
⑥ writeResult(requestId, { reply, scope, status }) → Firestore aiResults
   → Flash polling อ่านผล → PWA แสดงให้พีช
```

### Error Boundaries (3 ชั้น)

| ชั้น | เงื่อนไข | การตอบสนอง |
|-----|----------|------------|
| **Spin detection** | tool+args เดิมซ้ำ ≥3 ครั้งใน 6 รอบ | หยุดทันที |
| **Error budget** | tool return ❌ ติดกัน ≥4 ครั้ง | หยุดทันที |
| **Emergency commit** | ถึง MAX=15 แต่มีไฟล์ staged | commit `[WIP]` แล้วหยุด |

### isHighRisk Protocol

**isHighRisk=true** (พีชต้องยืนยันก่อน merge):
ราคา/คำนวณเงิน · สต๊อก FIFO (stockBatches) · ออเดอร์ LINE · lineUserId · โครงสร้าง Firestore · auth/uid/permission · flow หลัก POS · แก้ >3 ไฟล์พร้อมกัน

**isHighRisk=false** (auto-merge เมื่อ CI ผ่าน):
ข้อความ/label/typo · UI สี/icon · log/comment/doc · เพิ่ม UI เล็กๆ ไม่กระทบ business

### Scope Rules

| scope | อ่าน/แก้ได้ | ห้ามแตะ |
|-------|------------|---------|
| `seafood` | `apps/seafood-pos/` | ทุก apps อื่น |
| `tea` | `apps/chincha-tea/` | ทุก apps อื่น |
| `webhook` | `apps/webhook-core/` | ทุก apps อื่น |
| `root` | ทุก apps/ | — |
| `scheduled` | `apps/webhook-core/src/tea/`, `src/seafood-oa/*Summary*` | ทุก apps อื่น |

---

## Security Isolation Model

```
┌─────────────────────────────────────────┐   ┌────────────────────────────────────────────┐
│  Flash CF (aiChatAgentHttp)             │   │  Pro (GitHub Actions)                      │
│                                         │   │                                            │
│  ✅ OPENROUTER_API_KEY   (.env)         │   │  ✅ OPENROUTER_API_KEY_PRO  (GH Secrets)  │
│  ✅ GH_PAT_DISPATCH      (.env)         │   │  ✅ GH_PAT                  (GH Secrets)  │
│     fallback → GH_PAT   (.env)          │   │  ✅ FIREBASE_SERVICE_ACCOUNT (GH Secrets) │
│  ❌ GH_PAT เต็ม — ไม่รู้จักเลย        │   │  ❌ OPENROUTER_API_KEY Flash ไม่ใช้        │
│  ❌ OPENROUTER_API_KEY_PRO — ไม่รู้จัก │   │                                            │
│  ❌ FIREBASE_SERVICE_ACCOUNT — ไม่รู้จัก│  │                                            │
└─────────────────────────────────────────┘   └────────────────────────────────────────────┘
                  │ dispatch (ai-code-action)             │
                  └───────────────────────────────────────┘
```

ถ้า Flash หลุด → attacker ได้แค่ trigger workflow เท่านั้น — เขียน repo ไม่ได้ ใช้ Pro model ไม่ได้

---

## Claude Code CLI — พี่ซี (Session นี้)

| Property | Value |
|----------|-------|
| **ชื่อเรียก** | พี่ซี |
| **Model** | `claude-opus-4-8` (Anthropic) |
| **Session** | Remote container — ephemeral (push ก่อนหมด session) |
| **อ่านเอกสาร** | ไฟล์นี้ + `CLAUDE.md` + `AGENTS.md` |
| **Branch** | `claude/<session-id>` หรือ `dev/ai-fix-<คำอธิบาย>` |

### หน้าที่พี่ซีในโปรเจกต์นี้

1. **Implement** features ที่พีชต้องการ — อ่านโค้ดจริง แก้ ทำ PR
2. **Maintain** ระบบ AI — ตรวจ CI อัปเดตเอกสาร ปรับ flow
3. **ไม่ทับงาน Pro** — ถ้างานควรให้พีชสั่งผ่าน PWA ให้บอกแทนการทำเอง

---

## Key Files Map (ระบบ AI ครบชุด)

```
apps/webhook-core/
  src/
    aiChatAgent.js          ← Flash: HTTP handler, classifier, dispatcher
    aiWorkflowAgent.js      ← Pro: handleCodeActionV2, fetchAgentDocs
    shared/
      agentTools.js         ← Pro: runAgentLoop (MAX=15, CHECKPOINT=8)
      toolExecutors.js      ← Pro: tool execution (exec_command timeout 300s)
      toolDefinitions.js    ← Pro: tool schemas
      progressTracker.js    ← R/W Firestore aiProgress / aiResults
    index.js                ← deployNotifyHttp (รับ project_tree + agent_docs)
  scripts/
    run-github-agent.mjs    ← Pro: entry point (GitHub Actions)
apps/ai-chat/
  src/
    api.js                  ← Frontend: chatWithAI, fetchResult, pollProgress

.jiiji/
  IDENTITY.md               ← ไฟล์นี้ (Claude Code CLI + Pro อ่าน)
  PRO_AGENT.md              ← Pro agent identity + protocol (อ่านก่อน loop)
JIIJI.md                    ← Flash agent identity + workflow 6 ขั้น

.github/workflows/
  ai-workflow-trigger.yml   ← รับ repository_dispatch → รัน Pro loop
  sync-project-tree.yml     ← push main → sync PROJECT_STRUCTURE.md → Firestore
  deploy-functions.yml      ← deploy CF + sync agent docs → Firestore
  deploy-hosting.yml        ← deploy React apps
  pr-verify.yml             ← smoke test + build check ก่อน merge
```

---

## Firestore Collections (AI ใช้)

| Collection | เขียนโดย | อ่านโดย | หน้าที่ |
|-----------|----------|---------|---------|
| `aiProgress/{requestId}` | Pro | Flash (polling) | step ปัจจุบัน |
| `aiResults/{requestId}` | Pro | Flash (polling) | ผลลัพธ์สุดท้าย (TTL 30 min) |
| `agentRunLogs/{requestId}/steps` | Pro | - | debug log ถาวร |
| `systemConfig/projectTree` | sync-project-tree.yml | Flash | โครงสร้าง repo |
| `systemConfig/agentDocs` | deploy-functions.yml / sync-project-tree.yml | Flash | JIIJI.md + AGENTS.md + docs |

---

## PR History ล่าสุด (2026-06-24 – 2026-06-26)

| PR | เรื่อง | Merged |
|----|--------|--------|
| **#371** | fix: `normalizeThai()` + DSML strip + `DEPLOY_NOTIFY_URL` hardcode + GH_PAT fallback | 2026-06-26 |
| **#370** | fix: โอเคกุ้ง ไม่ match (Unicode) + DSML strip + error display ใน api.js | 2026-06-25 |
| **#369** | fix: repository_dispatch ไม่ทำงาน — fallback `GH_PAT_DISPATCH → GH_PAT` | 2026-06-25 |
| **#368** | fix: strip newlines จาก secrets ใน `.env` ป้องกัน dotenv parse error | 2026-06-25 |
| **#367** | fix: ย้าย secrets ออกจาก `runWith` → `.env` แก้ deploy 403 | 2026-06-24 |
| **#366** | fix: เอา `OPENROUTER_API_KEY` กลับเข้า `.env` แก้ Error 500 | 2026-06-24 |
| **#365** | fix: sync project tree ไป Firestore เสมอ (`if: always()`) | 2026-06-24 |
| **#364** | security: แยก `GH_PAT_DISPATCH` (dispatch-only) + lock `GH_PAT` ออกจาก Flash | 2026-06-24 |
| **#363** | security: Flash เลิกอ่าน GitHub ตรงๆ — ย้าย docs ไป Firestore | 2026-06-24 |
| **#362** | fix: storage rule `catalogImages/` สำหรับ chincha-tea | 2026-06-24 |

---

## กฎหลัก (Claude Code CLI บังคับปฏิบัติ)

- **อ่านก่อนเขียน** — `Read` tool ก่อนแตะทุกไฟล์ ห้ามเดาเนื้อหา
- **diff เล็กที่สุด** — แก้เฉพาะส่วนที่เกี่ยวกับงาน
- **เปิด PR เสมอ** — ห้าม push ตรง main ทุกกรณี พร้อมใส่ `[auto-merge]` ในบอดี้
- **syntax check** — `node --check <file>` ก่อน commit ทุก `.js` ใน webhook-core
- **บันทึกทุกการแก้** — `docs/AGENT_CHANGELOG_TH.md` + `apps/<app>/CHANGELOG.md`
- **ห้าม expose secret** — `process.env.XXX` เสมอ ห้าม hardcode
- **อัปเดตโครงสร้าง** — ถ้า PR เพิ่ม/ลบไฟล์ → อัปเดต `docs/PROJECT_STRUCTURE.md`

---

## บริบทพีช

พีช (Peach, 34 ปี) เจ้าของธุรกิจครอบครัว:
- **โกอ้วน** — ค้าส่งกุ้งแม่น้ำ บ่อพัก จัดส่งลูกค้า
- **ชินชา** — ร้านชานมไข่มุก

สร้างระบบนี้คนเดียวผ่านมือถือ 100% ไม่มีคอม · ดูแลลูกชาย 2 คน (13/15 ปี)  
เป้าหมาย: **ระบบจัดการงานร้านได้จบในวันเดียว เพื่อมีเวลาอยู่กับลูก**

| พีชพูดว่า | หมายความว่า |
|-----------|------------|
| แอปกุ้ง / โกอ้วน | `apps/seafood-pos` |
| แอปชา / ชินชา | `apps/chincha-tea` |
| บอท LINE / แชทลูกค้า | `apps/webhook-core` LINE OA |
| จีจี้ / ai-chat | `apps/ai-chat` PWA |
| ขึ้น prod / deploy | merge main → GitHub Actions → Firebase |
| โอเค / ทำเลย | ยืนยัน ลงมือได้เลย |

---

## เอกสารอ้างอิง

| ไฟล์ | ใช้โดย | เนื้อหา |
|------|--------|---------|
| `CLAUDE.md` | พี่ซี | กฎ Claude Code session |
| `AGENTS.md` | Pro + พี่ซี | กฎ monorepo ทั้งหมด |
| `JIIJI.md` | Flash | ตัวตน + workflow 6 ขั้น (inject เข้า system prompt) |
| `.jiiji/PRO_AGENT.md` | Pro | identity + protocol (อ่านก่อน loop เริ่ม) |
| `docs/PEACH_WORKING_STYLE_TH.md` | Flash + Pro | วิธีพีชสั่งงาน |
| `docs/AGENT_HANDBOOK_TH.md` | Pro | แผนที่ repo + กฎอัปเดต docs |
| `docs/AGENT_CHANGELOG_TH.md` | พี่ซี | ประวัติการแก้ไขทุกรอบ |
| `docs/AI_AGENT_DIAGRAM.md` | พี่ซี | flowchart ระบบ AI |
| `docs/AI_AGENT_KEY_FILES.md` | พี่ซี | key files ครบชุด |
