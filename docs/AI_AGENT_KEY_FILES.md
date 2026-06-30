# CHINCHA FLOW — AI Agent Key Files & Connections

อัปเดต: 2026-06-23 · แสดงเฉพาะไฟล์ที่เชื่อมโยงกับ AI agent ทั้งสองตัว

---

## โครงสร้างเชื่อมโยง (Project Tree)

```
chincha-business-os/
│
├── 🟢 FLASH AGENT (Cloud Function) ────────────────────────────────────────────
│   apps/webhook-core/src/
│   ├── aiChatAgent.js                    ← ✨ MAIN: HTTP endpoint หลัก (Flash entry)
│   │   ├── aiChatAgentHttp()             ← Cloud Function export (512MB · 540s)
│   │   ├── isCodeMetricsQuery()          ← shortcut: ถามนับบรรทัด → ตอบทันที
│   │   ├── detectQuickTrigger()          ← โอเคกุ้ง/โอเคชา → dispatch ทันที
│   │   ├── classifyAndTranslate()        ← Flash model classify intent → taskSpec
│   │   ├── fetchRepoFiles()              ← Flash Code Reader: อ่านโค้ดล่วงหน้า (GH_PAT_READ)
│   │   ├── buildTaskBrief()              ← รวม taskSpec + preloadedFiles → Task Brief
│   │   └── dispatchToProAgent()          ← POST github.com/repos/dispatches
│   │
│   ├── flash/                            ← Flash sub-modules (แยกจาก aiChatAgent.js)
│   │   ├── flashContext.js               ← Firestore loaders + fetchRepoFiles(GH_PAT_READ)
│   │   │   ├── loadProjectTree()         ← systemConfig/projectTree (TTL 5 min)
│   │   │   ├── loadCustomNotes()         ← systemConfig/customNotes (no cache)
│   │   │   ├── loadAgentDocs()           ← systemConfig/agentDocs (TTL 10 min)
│   │   │   ├── fetchJiijiDef()           ← JIIJI.md จาก agentDocs (max 3,500 chars)
│   │   │   ├── fetchChatAgentDocs()      ← AGENTS.md + docs จาก agentDocs
│   │   │   ├── fetchCodeMetrics()        ← docs/CODE_METRICS.md จาก agentDocs
│   │   │   └── fetchRepoFiles(pat, paths)← GitHub Contents API raw (max 5 ไฟล์ × 3,000 chars)
│   │   │
│   │   ├── flashTriggers.js              ← Quick triggers + classifier + Task Brief builder
│   │   │   ├── normalizeThai(str)        ← swap tone/สระล่าง (iPhone Unicode fix)
│   │   │   ├── detectQuickTrigger(msg)   ← โอเคกุ้ง/โอเคชา → {scope, task}
│   │   │   ├── isCodeMetricsQuery(text)  ← ตรวจว่าถาม metrics
│   │   │   ├── classifyAndTranslate()    ← Flash model → {intent, scope, taskSpec, ...}
│   │   │   └── buildTaskBrief()          ← taskSpec + preloadedFiles → markdown brief
│   │   │
│   │   ├── flashDispatch.js              ← GitHub repository_dispatch
│   │   │   └── dispatchToProAgent(pat, payload) ← POST /repos/.../dispatches
│   │   │
│   │   ├── flashModels.js                ← OpenRouter callers + model constants
│   │   │   ├── FLASH_MODEL               ← deepseek/deepseek-v4-flash
│   │   │   ├── VISION_MODEL              ← openai/gpt-4o-mini
│   │   │   ├── callOpenRouter()          ← Flash/Vision chat + DSML strip
│   │   │   └── callOpenRouterForWebSearch()← deepseek/deepseek-chat + web plugin
│   │   │
│   │   └── flashPrompts.js               ← System prompts per scope + detectScope
│   │       ├── SYSTEM_PROMPTS{}          ← prompt แยกตาม 5 scopes (root/seafood/tea/webhook/scheduled)
│   │       └── detectScope(msg, current) ← ตรวจ scope จากข้อความ
│   │
│   ├── deployNotify.js                   ← รับ POST action=project_tree / deploy_status
│   │   └── deployNotifyHttp()            ← เขียน Firestore systemConfig/projectTree + system/deploy_status
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
│       │   ├── runAgentLoop()            ← MAX_ITERATIONS=30, CHECKPOINT=9
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
│           ├── writeResult()             ← aiResults/{requestId} (TTL 2 ชั่วโมง)
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
├── 📄 AGENT IDENTITY DOCS ─────────────────────────────────────────────────────
│   .jiiji/IDENTITY.md                    ← สถาปัตยกรรม AI ครบชุด (พี่ซี + Pro อ่าน)
│   .jiiji/PRO_AGENT.md                  ← Pro: identity + tools list + protocol (อ่านก่อน loop)
│   JIIJI.md                             ← Flash: identity + workflow (inject เข้า system prompt)
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
① พีชพิมพ์  →  ② Flash classify  →  ③ Flash Code Reader (GH_PAT_READ)
                                              │
                                     ④ Task Brief + โค้ดแนบ  →  ⑤ dispatch event
                                                                         │
⑧ แสดงผล   ←  ⑦ Flash ส่งกลับ  ←  ⑥ Firestore aiResults/{id}  ←  Pro loop (tools)
```

---

## API Keys & Secrets Mapping

| Secret | อยู่ที่ | ใช้โดย | ทำได้ |
|--------|---------|--------|-------|
| `OPENROUTER_API_KEY` | GitHub Secrets → Firebase .env | Flash CF | แชท + classify (Flash model) |
| `OPENROUTER_API_KEY_PRO` | GitHub Secrets เท่านั้น | Pro GitHub Actions | agentic loop (Pro model) |
| `GH_PAT_DISPATCH` | Firebase .env (Secret Manager) | Flash (dispatch-only) | ส่ง repository_dispatch เท่านั้น |
| `GH_PAT_READ` | Firebase .env (Secret Manager) | Flash Code Reader | อ่านไฟล์โค้ดจาก GitHub API (Contents: Read-only) ก่อน dispatch |
| `GH_PAT` | GitHub Secrets + Firebase .env | Pro (full write) · Flash fallback | Pro: อ่าน+แก้+commit+PR / Flash fallback dispatch |
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
