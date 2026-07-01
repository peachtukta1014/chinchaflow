# CHINCHA FLOW — AI Agent System

อัปเดต: 2026-06-30 · รวม AI_AGENT_DIAGRAM + AI_AGENT_KEY_FILES เป็นไฟล์เดียว  
Flash อ่านได้ ~4,000 chars แรก (sections 1-5) · Pro + พี่ซีอ่านได้ทั้งหมด

---

## 1. 3-Agent Architecture

```
พีช → ai-chat PWA
          │ POST /aiChatAgentHttp
          ▼
🟢 FLASH (Cloud Function · asia-southeast1 · 512MB · 540s)
   model : deepseek/deepseek-v4-flash + openai/gpt-4o-mini (vision)
   keys  : OPENROUTER_API_KEY · GH_PAT_DISPATCH · GH_PAT_READ
   role  : Planner — classify intent · อ่านโค้ดล่วงหน้า · dispatch Task Brief
          │ repository_dispatch (ai-code-action)
          ▼
🔵 PRO (GitHub Actions · ai-workflow-trigger.yml · MAX 30 รอบ)
   model : deepseek/deepseek-v4-pro
   keys  : OPENROUTER_API_KEY_PRO · GH_PAT (full) · FIREBASE_SERVICE_ACCOUNT
   role  : Executor — อ่านโค้ด · แก้ไฟล์ · commit · เปิด PR
          │ writeResult → Firestore aiResults/{requestId}
          ▼
Flash polling → PWA แสดงผล

🔧 พี่ซี (Claude Code CLI · Anthropic · remote session นี้)
   role  : maintain · implement · ตรวจ PR — ไม่ได้รันใน production
```

## 2. Security Isolation

| | 🟢 Flash CF | 🔵 Pro Actions |
|---|---|---|
| รู้จัก | OPENROUTER_API_KEY, GH_PAT_DISPATCH, GH_PAT_READ | OPENROUTER_API_KEY_PRO, GH_PAT (full), FIREBASE_SERVICE_ACCOUNT |
| ไม่รู้จัก | GH_PAT เต็ม, OPENROUTER_API_KEY_PRO, FIREBASE_SERVICE_ACCOUNT | OPENROUTER_API_KEY |
| ทำได้ | classify · ตอบแชท · อ่านโค้ด (read-only) · dispatch | อ่าน/แก้ไฟล์ · commit · PR · deploy · เขียน Firestore |
| ทำไม่ได้ | แก้ไฟล์ · commit · PR | ตอบแชทพีชโดยตรง |

## 3. 5 Agent Scopes

| Scope | แก้ได้ | ห้ามแตะ |
|-------|--------|---------|
| `seafood` | `apps/seafood-pos/` | ทุก apps อื่น |
| `tea` | `apps/chincha-tea/` | ทุก apps อื่น |
| `webhook` | `apps/webhook-core/` | ทุก apps อื่น |
| `scheduled` | `apps/webhook-core/src/tea/` · `*Summary*.js` | ทุก apps อื่น |
| `root` | ทุก apps/ + docs/ + workflows/ | — |

## 4. Loop Limits & Error Boundaries

> ⚠️ ค่าด้านล่าง auto-synced โดย CI (`sync-ai-constants.yml`) จาก `agentTools.js` — ห้ามแก้ manual

```
MAX_ITERATIONS     = 22   — หยุดแน่นอน + emergency commit ถ้ามีไฟล์ staged
SUMMARY_CHECKPOINT =     — รอบ 9 บังคับสรุปความคืบหน้า แล้วดำเนินต่อ
aiResults TTL      = 2h   — Firestore aiResults/{requestId} หมดอายุหลัง 2 ชั่วโมง
timeout GHA        = 30m  — GitHub Actions timeout (ai-workflow-trigger.yml)
```

| ชั้น | เงื่อนไข | การตอบสนอง |
|-----|----------|------------|
| Spin detection | tool+args เดิมซ้ำ ≥3 ครั้งใน 6 รอบ | หยุดทันที |
| Consecutive errors | tool ❌ ติดกัน ≥4 ครั้ง | หยุดทันที |
| Per-tool errors | tool เดียวกัน ❌ รวม ≥4 ครั้ง | หยุดทันที |
| Emergency commit | ถึง MAX=30 มีไฟล์ staged | commit `[WIP]` แล้วหยุด |

---

## 5. Full Flowchart (Mermaid)

```mermaid
flowchart TD
    A([👤 พีชพิมพ์ข้อความ\nใน ai-chat PWA]) --> B[POST /aiChatAgentHttp\nส่ง message + history + scope + requestId]

    B --> C{ตรวจสอบ\nประเภทคำสั่ง}

    C -->|isCodeMetricsQuery| CM[📊 ดึง docs/CODE_METRICS.md\nจาก GitHub API\nตอบกลับทันที]
    CM --> Z([💬 PWA แสดงผล])

    C -->|detectQuickTrigger\nโอเคกุ้ง / โอเคชา| QT[dispatchToProAgent\nส่ง repository_dispatch\nscope=seafood/tea\nisHighRisk=false]
    QT --> FS1[(Firestore\naiProgress/requestId\nclear)]
    QT --> RQ([💬 กำลังตรวจ... + requestId])

    C -->|ข้อความทั่วไป| CL[🧠 classifyAndTranslate\nFlash Model · temp=0.1 · max_tokens=600\nวิเคราะห์ intent]

    CL --> D{intent?}

    D -->|chat| CH[โหลด context\n① FLASH.md จาก Firestore\n② AGENTS.md + docs จาก Firestore\n③ project tree จาก Firestore\nTTL: 10 นาที / 5 นาที]
    CH --> CR[callOpenRouter\nFlash Model\ntemp=0.3 · max_tokens=2048]
    CR -->|ผลลัพธ์ปกติ| WR1[(Firestore\naiResults/requestId)]
    CR --> Z

    CR -->|ตรวจพบ [WEB_SEARCH: query]| WS[🌐 Web Search\ncallOpenRouterForWebSearch\ndeepseek/deepseek-chat\n+ web plugin · max_results=3]
    WS --> WSR[ได้ผลจากเว็บ\nส่งกลับให้ Flash\nเป็น context เพิ่มเติม]
    WSR --> CR2[callOpenRouter\nFlash Model อีกครั้ง\nตอบสรุปพร้อมแหล่งข้อมูล]
    CR2 --> WR1

    D -->|code-action\nneedsConfirmation=true| CF[ส่ง confirmationMessage\nกลับให้พีชยืนยัน\nstatus=pending-code-action]
    CF --> Z
    A -->|พีชพิมพ์ ทำเลย\nneedsConfirmation=false| CL

    D -->|code-action\nneedsConfirmation=false| FCR[🔍 Flash Code Analysis Loop\nrunFlashAnalysisLoop · GH_PAT_READ เท่านั้น\nread_file/list_files/search_code วนสูงสุด 6 รอบ\nจบด้วย finalize_task_brief → taskSpec ยืนยันจากโค้ดจริง]
    FCR --> CF2[ส่ง confirmationMessage\nจากโค้ดที่อ่านจริง\nรอพีชพิมพ์ "ไฟเขียว"]
    CF2 --> Z
    A -->|พีชพิมพ์ "ไฟเขียว"| CA[dispatchToProAgent\nGH_PAT_DISPATCH เท่านั้น\nPOST github.com/repos/dispatches\nevent_type=ai-code-action\n+ Task Brief ที่ยืนยันแล้ว]
    CA --> FS2[(Firestore\naiProgress/requestId\nclear)]
    CA --> RP([💬 รับงานแล้ว กำลังดำเนินการ\nstatus=processing + requestId])

    subgraph POLLING["🔄 PWA Polling Loop (ทุก 2-3 วิ)"]
        P1[GET /aiChatAgentHttp\n?action=progress&requestId=xxx] --> P2[(Firestore\naiProgress/requestId)]
        P3[GET /aiChatAgentHttp\n?action=result&requestId=xxx] --> P4[(Firestore\naiResults/requestId)]
    end

    CA --> POLLING

    subgraph GHA["🔵 PRO AGENT — GitHub Actions"]
        GH1[ai-workflow-trigger.yml\nรับ repository_dispatch\nevent: ai-code-action] --> GH2[run-github-agent.mjs\nparse AGENT_TASK_PAYLOAD]
        GH2 --> GH3[handleCodeActionV2\naiWorkflowAgent.js\nOPENROUTER_API_KEY_PRO]
        GH3 --> GH4[fetchAgentDocs\nอ่าน AGENTS.md + docs\nจาก GitHub API]
        GH4 --> GH5[buildAgentSystemPrompt\nSCOPE_FILE_TREE\nเลือกไฟล์ตาม scope]
        GH5 --> GH6[runAgentLoop\nagentTools.js\nMAX_ITERATIONS=22\nCHECKPOINT=]

        GH6 --> TOOL{AI เลือก tool\nทีละขั้น}
        TOOL -->|read_file| T1[GitHub API\nดึงเนื้อไฟล์]
        TOOL -->|list_files| T2[GitHub API\nดูรายการไฟล์]
        TOOL -->|search_code| T3[GitHub API\nค้นหาโค้ด]
        TOOL -->|patch_file\nwrite_file| T4[แก้โค้ดใน memory]
        TOOL -->|commit_and_pr| T5[GitHub API\nสร้าง branch + commit\n+ เปิด PR อัตโนมัติ]
        TOOL -->|trigger_deploy| T6[GitHub Actions\ndeploy workflow]
        TOOL -->|report_no_action_needed| T7[ไม่ต้องแก้ รายงานผล]

        T1 & T2 & T3 & T4 --> TOOL
        T5 --> GH7[writeResult\nFirestore aiResults/requestId\nreply + PR URL + scope\nTTL 2 ชั่วโมง]
        T7 --> GH7
    end

    GHA --> PR_V[pr-verify.yml\nsmoke test + build\ncomment ผลใน PR]
    GH7 --> WR2[(Firestore\naiResults/requestId\nTTL 2 ชั่วโมง)]
    POLLING --> WR2
    WR2 --> Z2([💬 PWA แสดงผลสุดท้าย\nรวม PR URL])

    subgraph TREE_SYNC["📁 Project Tree Sync"]
        TS1[sync-project-tree.yml\nทุกครั้งที่ push main] --> TS2[อ่าน docs/PROJECT_STRUCTURE.md\nส่งไป deployNotifyHttp\naction=project_tree]
        TS2 --> TS3[(Firestore\nsystemConfig/projectTree\nTTL 5 นาที)]
        TS3 --> CH
    end
```

---

## 6. requestId Lifecycle

```
พีชส่งข้อความ
     │
     ▼
Flash CF สร้าง requestId (ถ้าไม่มีจาก client)
     │
     ├─► Firestore aiProgress/{requestId}  ← "กำลังวิเคราะห์..."
     │
     ├─► dispatch → Pro Agent รับงาน
     │        │
     │        ├─► aiProgress/{requestId}  ← "กำลังโหลดบริบท..."
     │        ├─► aiProgress/{requestId}  ← "กำลังอ่านไฟล์ X..."
     │        ├─► aiProgress/{requestId}  ← "กำลัง patch..."
     │        └─► aiProgress/{requestId}  ← "กำลัง commit..."
     │
     ├─► Pro เสร็จ → aiResults/{requestId}  ← {reply, PR URL}
     │             → aiProgress/{requestId}  ← DELETE
     │             → agentRunLogs/{requestId}/steps  ← log ถาวร
     │
     └─► PWA poll อ่าน aiResults → แสดงผล → clearResult (DELETE)
```

## 7. Web Search Flow (Flash เท่านั้น)

```
① Flash ตอบมา → ตรวจพบ [WEB_SEARCH: query] ในผลลัพธ์
② callOpenRouterForWebSearch(query)
   model: deepseek/deepseek-chat · plugins: [{ id: 'web', max_results: 3 }]
③ ได้ผลจากเว็บ (snippet + URL) → ส่งเป็น context เพิ่มให้ Flash
④ Flash เรียก callOpenRouter อีกครั้ง → ตอบสรุปพร้อมแหล่งอ้างอิง
```

Pro Agent ไม่มี web search — ค้นเว็บได้แค่ Flash เท่านั้น

---

## 8. Key Files Map

```
chincha-business-os/
│
├── 🟢 FLASH AGENT (Cloud Function) ──────────────────────────────────────────
│   apps/webhook-core/src/
│   ├── aiChatAgent.js                    ← MAIN: HTTP endpoint หลัก (Flash entry)
│   │   ├── aiChatAgentHttp()             ← Cloud Function export (512MB · 540s)
│   │   ├── isCodeMetricsQuery()          ← shortcut: ถามนับบรรทัด → ตอบทันที
│   │   ├── detectQuickTrigger()          ← โอเคกุ้ง/โอเคชา → dispatch ทันที
│   │   ├── classifyAndTranslate()        ← Flash model classify intent → taskSpec เบื้องต้น
│   │   ├── runFlashAnalysisLoop()        ← Flash Code Analysis Loop (GH_PAT_READ) — อ่านโค้ดจริงก่อนสรุป
│   │   ├── buildTaskBrief()              ← taskSpec ที่ยืนยันจากโค้ดจริง → Task Brief
│   │   └── dispatchToProAgent()          ← POST github.com/repos/dispatches (หลังพีชพิมพ์ "ไฟเขียว")
│   │
│   ├── flash/
│   │   ├── flashContext.js               ← Firestore loaders + fetchRepoFiles
│   │   │   ├── loadProjectTree()         ← systemConfig/projectTree (TTL 5 min)
│   │   │   ├── loadCustomNotes()         ← systemConfig/customNotes (no cache)
│   │   │   ├── loadAgentDocs()           ← systemConfig/agentDocs (TTL 10 min)
│   │   │   ├── fetchJiijiDef()           ← FLASH.md จาก agentDocs (max 3,500 chars)
│   │   │   ├── fetchChatAgentDocs()      ← AGENTS.md + docs จาก agentDocs
│   │   │   ├── fetchCodeMetrics()        ← docs/CODE_METRICS.md จาก agentDocs
│   │   │   ├── fetchRepoFiles(pat, paths)← GitHub Contents API (max 5 × 3,000 chars) — ใช้โดย flashAnalysisLoop.js
│   │   │   └── fetchScopeSkill(pat, sc)  ← .skill/scope-{sc}.md ผ่าน GH_PAT_READ
│   │   ├── flashTriggers.js              ← Quick triggers + classifier + Task Brief
│   │   ├── flashAnalysisLoop.js          ← Code Analysis Loop (read-only): read_file/list_files/search_code
│   │   │                                    → finalize_task_brief · MAX_ITERATIONS=6 · ผูก GH_PAT_READ เท่านั้น
│   │   ├── flashDispatch.js              ← POST /repos/.../dispatches
│   │   ├── flashModels.js                ← FLASH_MODEL, VISION_MODEL, callOpenRouter()
│   │   └── flashPrompts.js               ← SYSTEM_PROMPTS{} แยกตาม 5 scopes
│   │
│   ├── deployNotify.js                   ← รับ project_tree / deploy_status
│   └── index.js                          ← export Cloud Functions ทั้งหมด
│
├── 🔵 PRO AGENT (GitHub Actions) ────────────────────────────────────────────
│   .github/workflows/
│   └── ai-workflow-trigger.yml           ← TRIGGER: repository_dispatch ai-code-action
│       ├── timeout-minutes: 30
│       └── secrets: OPENROUTER_API_KEY_PRO, GH_PAT, FIREBASE_SERVICE_ACCOUNT
│
│   apps/webhook-core/scripts/
│   └── run-github-agent.mjs              ← ENTRY: parse AGENT_TASK_PAYLOAD → handleCodeActionV2
│
│   apps/webhook-core/src/
│   ├── aiWorkflowAgent.js                ← MAIN: Pro agent orchestrator
│   │   ├── handleCodeActionV2()          ← entry point
│   │   ├── SCOPE_FILE_TREE{}             ← ไฟล์แยกตาม scope
│   │   └── buildAgentSystemPrompt()      ← system prompt + scope skill
│   │
│   └── shared/
│       ├── agentTools.js                 ← LOOP: MAX_ITERATIONS=22, CHECKPOINT=
│       │   └── runAgentLoop()            ← agentic loop orchestrator
│       ├── toolDefinitions.js            ← tool schemas (10 tools)
│       ├── toolExecutors.js              ← execute tool calls ผ่าน GitHub API
│       └── progressTracker.js            ← Firestore R/W (aiProgress, aiResults, logs)
│           └── writeResult()             ← aiResults/{requestId} (TTL 2 ชั่วโมง)
│
├── 🔴 FIRESTORE — Message Bus ───────────────────────────────────────────────
│   aiProgress/{requestId}                ← Pro → Flash: สถานะ step ปัจจุบัน
│   aiResults/{requestId}                 ← Pro → Flash: ผลลัพธ์สุดท้าย (TTL 2 ชั่วโมง)
│   agentRunLogs/{requestId}/steps        ← debug log ถาวร
│   systemConfig/projectTree              ← Flash อ่าน tree (TTL 5 min)
│   systemConfig/agentDocs                ← docs sync จาก repo (TTL 10 min)
│
├── 🟡 SUPPORTING WORKFLOWS ──────────────────────────────────────────────────
│   .github/workflows/
│   ├── sync-project-tree.yml             ← PROJECT_STRUCTURE.md → Firestore (auto)
│   ├── sync-ai-constants.yml             ← MAX/CHECKPOINT จาก agentTools.js → docs (auto)
│   ├── auto-changelog.yml                ← PR merge → AGENT_CHANGELOG_TH.md (auto)
│   ├── pr-verify.yml                     ← smoke test + build หลัง Pro เปิด PR
│   ├── deploy-functions.yml              ← deploy Flash CF + sync agentDocs Firestore
│   └── deploy-hosting.yml                ← deploy PWA (ai-chat, seafood-pos, chincha-tea)
│
├── 📄 AGENT IDENTITY DOCS ────────────────────────────────────────────────────
│   FLASH.md                              ← Flash: identity + workflow (inject เข้า system prompt)
│   PRO.md                                ← Pro: identity + tools + protocol
│
└── 📄 AGENT CONTEXT DOCS (Flash อ่านจาก Firestore) ─────────────────────────
    AGENTS.md                             ← กฎ monorepo (max 6,000 chars)
    docs/AI_AGENT_SYSTEM.md              ← ไฟล์นี้ — สถาปัตยกรรม AI ครบชุด (max 4,000 chars)
    docs/PROJECT_STRUCTURE.md            ← โครงสร้างโฟลเดอร์ (auto-sync → Firestore)
    docs/PEACH_WORKING_STYLE_TH.md       ← สไตล์พี่พีชสั่งงาน (max 5,000 chars)
    docs/AGENT_HANDBOOK_TH.md            ← คู่มือ debug + doc rules (max 5,000 chars)
    docs/CODE_METRICS.md                 ← สถิตินับบรรทัด (auto-generated by CI)
```

---

## 9. API Keys & Secrets

| Secret | อยู่ที่ | ใช้โดย | ทำได้ |
|--------|---------|--------|-------|
| `OPENROUTER_API_KEY` | GitHub Secrets → Firebase .env | Flash CF | แชท + classify (Flash model) |
| `OPENROUTER_API_KEY_PRO` | GitHub Secrets เท่านั้น | Pro GitHub Actions | agentic loop (Pro model) |
| `GH_PAT_DISPATCH` | Firebase .env (Secret Manager) | Flash | ส่ง repository_dispatch เท่านั้น |
| `GH_PAT_READ` | Firebase .env (Secret Manager) | Flash Code Reader | อ่านโค้ดจาก GitHub API (Contents: Read-only) |
| `GH_PAT` | GitHub Secrets + Firebase .env | Pro (full) · Flash fallback | Pro: อ่าน+แก้+commit+PR |
| `FIREBASE_SERVICE_ACCOUNT` | GitHub Secrets | Pro GitHub Actions | เขียน Firestore (aiResults, aiProgress) |
| `DEPLOY_NOTIFY_URL` | GitHub Secrets | sync-project-tree.yml | curl ไป deployNotifyHttp |
