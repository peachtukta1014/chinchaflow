# CHINCHA FLOW — AI Agent Key Files & Connections

อัปเดต: 2026-06-23 · แสดงเฉพาะไฟล์ที่เชื่อมโยงกับ AI agent ทั้งสองตัว

---

## โครงสร้างเชื่อมโยง (Project Tree)

```
chincha-business-os/
│
├── 🟢 FLASH AGENT (Cloud Function) ────────────────────────────────────────────
│   apps/webhook-core/src/
│   ├── aiChatAgent.js                    ← ✨ MAIN: HTTP endpoint หลัก
│   │   ├── aiChatAgentHttp()             ← Cloud Function export
│   │   ├── classifyAndTranslate()        ← Flash model classify intent
│   │   ├── detectScope()                 ← seafood/tea/webhook/root
│   │   ├── detectQuickTrigger()          ← โอเคกุ้ง/โอเคชา shortcut
│   │   ├── dispatchToProAgent()          ← POST github.com/repos/dispatches
│   │   ├── fetchChatAgentDocs()          ← อ่าน AGENTS.md + docs (TTL 10 min)
│   │   ├── fetchJiijiDef()               ← อ่าน JIIJI.md (TTL 10 min)
│   │   ├── loadProjectTree()             ← อ่าน Firestore systemConfig/projectTree (TTL 5 min)
│   │   ├── isCodeMetricsQuery()          ← ตรวจว่าถามนับบรรทัด
│   │   ├── fetchCodeMetrics()            ← อ่าน docs/CODE_METRICS.md จาก GitHub
│   │   ├── callOpenRouter()              ← Flash / Vision model
│   │   └── SYSTEM_PROMPTS{}             ← prompt แยกตาม 5 scopes
│   │
│   ├── deployNotify.js                   ← รับ POST action=project_tree
│   │   └── deployNotifyHttp()            ← เขียน Firestore systemConfig/projectTree
│   │
│   └── index.js                          ← export Cloud Functions ทั้งหมด
│       ├── aiChatAgentHttp               ← Flash agent endpoint
│       ├── deployNotifyHttp              ← project tree + deploy notification
│       ├── lineWebhook                   ← กุ้ง LINE Bot
│       ├── lineWebhookTea                ← ชา LINE Bot
│       └── ...ฯลฯ
│
├── 🔵 PRO AGENT (GitHub Actions) ──────────────────────────────────────────────
│   .github/workflows/
│   └── ai-workflow-trigger.yml           ← ✨ TRIGGER: รับ repository_dispatch
│       ├── on: repository_dispatch       ← event_type: ai-code-action
│       ├── timeout-minutes: 30
│       ├── secrets: OPENROUTER_API_KEY_PRO, GH_PAT, FIREBASE_SERVICE_ACCOUNT
│       └── run: node scripts/run-github-agent.mjs
│
│   apps/webhook-core/scripts/
│   └── run-github-agent.mjs              ← ✨ ENTRY: รัน Pro agent
│       ├── parse AGENT_TASK_PAYLOAD      ← {requestId, message, scope, history, isHighRisk}
│       ├── initializeApp()               ← Firebase Admin via GOOGLE_APPLICATION_CREDENTIALS
│       └── handleCodeActionV2()          ← เรียก aiWorkflowAgent.js
│
│   apps/webhook-core/src/
│   ├── aiWorkflowAgent.js                ← ✨ MAIN: Pro agent orchestrator
│   │   ├── handleCodeActionV2()          ← entry point จาก run-github-agent.mjs
│   │   ├── SCOPE_FILE_TREE{}             ← รายชื่อไฟล์แยกตาม scope (seafood/tea/webhook/root)
│   │   ├── buildAgentSystemPrompt()      ← system prompt ฉบับ developer
│   │   ├── fetchAgentDocs()              ← อ่าน AGENTS.md + docs จาก GitHub
│   │   └── fetchRepoFile()               ← อ่านไฟล์จาก GitHub API
│   │
│   └── shared/
│       ├── agentTools.js                 ← ✨ LOOP: agentic loop orchestrator
│       │   ├── runAgentLoop()            ← MAX_ITERATIONS=15, CHECKPOINT=8
│       │   ├── parseXmlToolCalls()       ← DeepSeek XML fallback parser
│       │   ├── stripDsml()               ← ลบ DSML markup จาก output
│       │   └── stripXmlToolCalls()       ← ลบ XML tool call ออกจากข้อความสุดท้าย
│       │
│       ├── toolDefinitions.js            ← tool schemas สำหรับ OpenRouter
│       │   ├── TOOL_DEFINITIONS[]        ← read_file, list_files, search_code,
│       │   │                             ←  patch_file, write_file, commit_and_pr,
│       │   │                             ←  trigger_deploy, get_skill,
│       │   │                             ←  exec_command, report_no_action_needed
│       │   ├── AGENT_MODEL               ← deepseek/deepseek-v4-pro
│       │   └── OPENROUTER_BASE           ← https://openrouter.ai/api/v1
│       │
│       ├── toolExecutors.js              ← ✨ TOOLS: execute tool calls จริง
│       │   ├── fetchRepoFile()           ← GitHub API read file
│       │   ├── executeTool()             ← router: dispatch ไป executor ที่ถูกต้อง
│       │   ├── read_file executor        ← GitHub contents API
│       │   ├── list_files executor       ← GitHub trees API
│       │   ├── search_code executor      ← GitHub search/code API
│       │   ├── patch_file executor       ← patch เนื้อไฟล์ใน memory
│       │   ├── write_file executor       ← เขียนไฟล์ใหม่ใน memory
│       │   ├── commit_and_pr executor    ← สร้าง branch + blob + tree + commit + PR
│       │   └── trigger_deploy executor   ← POST GitHub Actions dispatch
│       │
│       └── progressTracker.js            ← Firestore R/W สำหรับ polling
│           ├── writeProgress()           ← aiProgress/{requestId}
│           ├── readProgress()            ← polling endpoint อ่าน
│           ├── clearProgress()           ← ลบหลังงานเสร็จ
│           ├── writeResult()             ← aiResults/{requestId} (TTL 30 min)
│           ├── readResult()              ← recovery endpoint อ่าน
│           ├── clearResult()             ← ลบหลัง client อ่านแล้ว
│           └── appendRunLog()            ← agentRunLogs/{requestId}/steps (ถาวร)
│
├── 🔴 FIRESTORE — Message Bus ──────────────────────────────────────────────────
│   aiProgress/{requestId}                ← Pro → Flash: สถานะ step ปัจจุบัน
│   │   step: "กำลังอ่านไฟล์..."
│   │   ts: timestamp
│   │
│   aiResults/{requestId}                 ← Pro → Flash: ผลลัพธ์สุดท้าย (TTL 30 min)
│   │   reply: "เสร็จแล้ว ดู PR #xxx"
│   │   scope: "seafood"
│   │   status: "completed"|"error"
│   │   expiresAt: timestamp
│   │
│   agentRunLogs/{requestId}/steps        ← debug log ถาวร
│   │   iteration, model, finishReason, toolName, ts
│   │
│   systemConfig/projectTree              ← Flash อ่าน tree (TTL 5 min)
│       tree: "..." (สูงสุด 50,000 chars)
│       sha: git commit SHA
│       updatedAt: ISO string
│       syncedAt: server timestamp
│
├── 🟡 GITHUB ACTIONS — Supporting Workflows ───────────────────────────────────
│   .github/workflows/
│   ├── ai-workflow-trigger.yml           ← Pro Agent trigger (repository_dispatch)
│   ├── sync-project-tree.yml             ← sync PROJECT_STRUCTURE.md → Firestore
│   ├── pr-verify.yml                     ← smoke test + build หลัง Pro เปิด PR
│   ├── deploy-functions.yml              ← deploy Flash CF (aiChatAgentHttp ฯลฯ)
│   └── deploy-hosting.yml                ← deploy PWA (ai-chat, seafood-pos, chincha-tea)
│
├── 📄 AGENT CONTEXT DOCS (Flash อ่านก่อนตอบทุกครั้ง via GitHub API) ──────────
│   JIIJI.md                              ← บุคลิก จีจี้ + ความสามารถ
│   AGENTS.md                             ← กฎ monorepo (max 6,000 chars)
│   docs/PEACH_WORKING_STYLE_TH.md       ← สไตล์พี่พีชสั่งงาน (max 5,000 chars)
│   docs/AGENT_HANDBOOK_TH.md            ← แผนที่ repo + กฎ docs (max 5,000 chars)
│   docs/PROJECT_STRUCTURE.md            ← โครงสร้างโฟลเดอร์ (sync → Firestore)
│   docs/CODE_METRICS.md                 ← สถิตินับบรรทัด (อ่านเมื่อถาม metrics)
│
├── 📄 AGENT CONTEXT DOCS (Pro อ่านก่อน agentic loop) ────────────────────────
│   AGENTS.md                             ← กฎ monorepo
│   docs/PEACH_WORKING_STYLE_TH.md       ← สไตล์พี่พีช
│   docs/AGENT_HANDBOOK_TH.md            ← คู่มือ agent
│
├── 🌐 AI CHAT PWA ────────────────────────────────────────────────────────────
│   apps/ai-chat/
│   └── (PWA เรียก aiChatAgentHttp · poll requestId · แสดงผล)
│
└── 📱 ผลลัพธ์งาน Pro ──────────────────────────────────────────────────────────
    GitHub Pull Request (เปิดอัตโนมัติ)
    └── pr-verify.yml ตรวจ smoke + build → comment ผลในหน้า PR ก่อนพี่กด merge
        └── merge → deploy-hosting.yml / deploy-functions.yml → production
```

---

## Data Flow ย่อ

```
① พีชพิมพ์  →  ② Flash classify  →  ③ dispatch event  →  ④ Pro loop (tools)
                                                                    │
⑦ แสดงผล   ←  ⑥ Flash ส่งกลับ  ←  ⑤ Firestore aiResults/{id}  ◄──┘
```

---

## API Keys & Secrets Mapping

| Secret | อยู่ที่ | ใช้โดย | ทำได้ |
|--------|---------|--------|-------|
| `OPENROUTER_API_KEY` | GitHub Secrets → Firebase .env | Flash CF | แชท + classify (Flash model) |
| `OPENROUTER_API_KEY_PRO` | GitHub Secrets เท่านั้น | Pro GitHub Actions | agentic loop (Pro model) |
| `GH_PAT` | GitHub Secrets | Flash (read + dispatch) · Pro (full write) | Flash: อ่านไฟล์ + ส่ง dispatch / Pro: อ่าน+แก้+commit+PR |
| `FIREBASE_SERVICE_ACCOUNT` | GitHub Secrets | Pro GitHub Actions | เขียน Firestore (aiResults, aiProgress) |
| `DEPLOY_NOTIFY_URL` | GitHub Secrets | sync-project-tree.yml | curl ไป deployNotifyHttp |

---

## Flash vs Pro — เส้นทางแยกกันชัดเจน

```
Flash CF (aiChatAgent.js)             Pro Agent (aiWorkflowAgent.js)
══════════════════════════            ═══════════════════════════════
OPENROUTER_API_KEY  ✅               OPENROUTER_API_KEY_PRO  ✅
GH_PAT (read only)  ✅               GH_PAT (full write)     ✅
FIREBASE_SERVICE_ACCOUNT ❌          FIREBASE_SERVICE_ACCOUNT ✅
                                     
รัน: Cloud Function (60s-540s)       รัน: GitHub Actions (30 นาที)
ข้อความ: ตอบทันที                   ข้อความ: async ผ่าน Firestore
commit/PR: ❌ ทำไม่ได้              commit/PR: ✅ ทำได้โดยตรง
```
