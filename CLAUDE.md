# CLAUDE.md — กฎการทำงานของ Claude Code (พี่ซี) ในโปรเจกต์นี้

> **พี่ซี** = Claude Code CLI — ทำงานผ่าน remote session (ephemeral container) เข้าจากมือถือพีช

อ่านเอกสารด้านล่างก่อนลงมือทุกครั้ง เรียงตามลำดับสำคัญ:

1. `AGENTS.md` — กฎ monorepo, ของที่มีอยู่แล้ว, อย่าเพิ่มซ้ำ
2. `docs/PEACH_WORKING_STYLE_TH.md` — วิธีพีช (Peach) สั่งงาน, คำศัพท์, ทบทวนก่อนลงมือ
3. `docs/AGENT_HANDBOOK_TH.md` — แผนที่ repo, กฎอัปเดต docs
4. `docs/AGENT_CHANGELOG_TH.md` — รอบก่อนแก้อะไร — อ่านก่อนไล่บั๊กทุกครั้ง
5. `.jiiji/IDENTITY.md` — สถาปัตยกรรม AI ครบชุด (Flash / Pro / พี่ซี)

---

## กฎหลัก

- **อ่านก่อนเขียน** — ใช้ Read tool อ่านไฟล์จริงก่อนทุกครั้ง ห้ามเดาเนื้อไฟล์
- **diff เล็กที่สุด** — แก้เฉพาะส่วนที่เกี่ยวกับงาน ห้ามแตะส่วนอื่นโดยไม่จำเป็น
- **เปิด PR เสมอ (ห้าม draft)** — ห้าม push ตรง main ทุกกรณี พัฒนาบน branch แล้วเปิด PR **แบบปกติ (ไม่ใช่ draft)** — รอพีชกด merge เอง หรือบอกให้พี่ซี merge ให้ได้ (ใช้ `gh pr merge <number> --squash`)
- **อ่าน changelog ก่อนลงมือเสมอ** — `docs/AGENT_CHANGELOG_TH.md` ดูว่ารอบก่อนแก้อะไรไปแล้ว ป้องกันแก้ซ้ำหรือขัดกัน
- **บันทึกทุกการแก้ใน PR เดียวกัน** — อัปเดต `docs/AGENT_CHANGELOG_TH.md` **และ** `apps/<app>/CHANGELOG.md` ของแอปที่เปลี่ยน ก่อน push ทุกครั้ง ไม่ต้องรอ merge
- **อัปเดตโครงสร้าง** — ถ้า PR เพิ่ม/ลบ/ย้ายไฟล์หรือโฟลเดอร์ → อัปเดต `docs/PROJECT_STRUCTURE.md` ใน PR เดียวกัน
- **อย่าเพิ่มซ้ำ** — ตรวจ `AGENTS.md` ก่อนว่ามีทางเดิมอยู่แล้วหรือไม่
- **ทบทวนก่อนลงมือ** (ถ้างานไม่ชัด) — สรุปกลับสั้นๆ รอพีชยืนยันก่อนเปิด PR ใหญ่
- **ตอบเป็นภาษาไทยเสมอ** — พีชขับรถส่งกุ้งทั้งวัน อ่านอังกฤษลำบาก ตอบสั้น กระชับ อ่านบนมือถือได้
- **syntax check** — `node --check <file>` ก่อน commit ทุก `.js` ใน `apps/webhook-core/src/`
- **ห้าม expose secret** — `process.env.XXX` เสมอ ห้าม hardcode token/key ในโค้ด

---

## Branch & Commit convention

- Branch: `dev/ai-fix-<คำอธิบายสั้นๆ>` หรือ `claude/<session-id>`
- Commit: `fix/feat/docs: <อธิบายสั้นๆ ภาษาไทยหรืออังกฤษ>`

---

## โครงสร้าง repo (สรุป)

**CHINCHA FLOW** — business operations platform (POS + inventory + CRM + LINE)  
Firebase project: `chincha-eeed6` · Cloud: `asia-southeast1`

| แอป | โฟลเดอร์ | URL | หน้าที่ |
|-----|---------|-----|--------|
| Tea POS | `apps/chincha-tea/` | chincha-tea.web.app | ร้านชา — ขาย/สรุป/สั่งของ/หลายภาษา |
| Shrimp POS | `apps/seafood-pos/` | ko-seafood.top | กุ้ง — POS/สต๊อก FIFO/ลูกหนี้/ออเดอร์ LINE |
| AI Admin Chat | `apps/ai-chat/` | chincha-ai-chat.web.app | คุยกับ AI ควบคุมระบบ (เจ้าของร้านเท่านั้น) |
| LINE Backend | `apps/webhook-core/` | Cloud Functions | LINE webhook กุ้ง/ชา + AI Chat Agent |
| Cron Scheduled | `apps/webhook-core-scheduled/` | Cloud Functions | สรุปยอดชาอัตโนมัติทุกชั่วโมง |

- `.github/workflows/` — CI/CD (deploy-hosting, deploy-functions, deploy-rules, pr-verify, ai-workflow-trigger, sync-project-tree, code-metrics)
- `firestore.rules` / `storage.rules` — กฎความปลอดภัยร่วม
- `docs/` — เอกสารทีม/สถาปัตยกรรม
- `.claude/commands/` — Claude Code skills (land-it, peter-ser, ship-*, auto-*)
- `.jiiji/` — IDENTITY.md, PRO_AGENT.md (AI agent config)

---

## ระบบ AI ของโปรเจกต์ (ห้ามสับสน)

```
พีชพิมพ์ใน PWA (ai-chat)
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│  FLASH AGENT — จีจี้แชท                                     │
│  model: deepseek/deepseek-v4-flash (OpenRouter)             │
│  runs:  Cloud Function aiChatAgentHttp · asia-southeast1    │
│  key:   OPENROUTER_API_KEY (Secret Manager)                 │
│  PAT:   GH_PAT_DISPATCH || GH_PAT (dispatch เท่านั้น)       │
│  file:  apps/webhook-core/src/aiChatAgent.js                │
└────────────────────────┬────────────────────────────────────┘
                         │ repository_dispatch (ai-code-action)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  PRO AGENT — จีจี้โปร                                       │
│  model: deepseek/deepseek-v4-pro (OpenRouter)               │
│  runs:  GitHub Actions · ai-workflow-trigger.yml            │
│  key:   OPENROUTER_API_KEY_PRO (GitHub Secrets เท่านั้น)    │
│  PAT:   GH_PAT (read/write repo เต็ม)                       │
│  file:  apps/webhook-core/scripts/run-github-agent.mjs      │
│  loop:  MAX_ITERATIONS=15, SUMMARY_CHECKPOINT=8             │
└────────────────────────┬────────────────────────────────────┘
                         │ writeResult → Firestore aiResults
                         ▼ Flash polling → PWA แสดงให้พีช
┌─────────────────────────────────────────────────────────────┐
│  CLAUDE CODE CLI — พี่ซี (session นี้)                      │
│  model: claude-opus-4-8 (Anthropic)                         │
│  runs:  Remote container — ephemeral (push ก่อนหมด session) │
│  role:  implement, maintain, ตรวจ PR, อัปเดตระบบ            │
└─────────────────────────────────────────────────────────────┘
```

**Security Isolation:** Flash มีแค่ `GH_PAT_DISPATCH` dispatch ได้อย่างเดียว — ไม่รู้จัก `OPENROUTER_API_KEY_PRO` และ `GH_PAT` เต็ม ถ้า Flash key หลุด attacker เขียน repo ไม่ได้

### Key Files ระบบ AI

| ไฟล์ | หน้าที่ |
|------|--------|
| `apps/webhook-core/src/aiChatAgent.js` | Flash: HTTP handler, classifier, dispatcher, quick triggers |
| `apps/webhook-core/src/aiWorkflowAgent.js` | Pro: handleCodeActionV2, fetchAgentDocs, isHighRisk |
| `apps/webhook-core/src/shared/agentTools.js` | Pro: runAgentLoop orchestrator + OpenRouter caller |
| `apps/webhook-core/src/shared/toolDefinitions.js` | Pro: TOOL_DEFINITIONS (10 tools) + constants |
| `apps/webhook-core/src/shared/toolExecutors.js` | Pro: executeTool switch-case + fetchRepoFile |
| `apps/webhook-core/src/shared/progressTracker.js` | R/W Firestore aiProgress / aiResults / agentRunLogs |
| `apps/webhook-core/scripts/run-github-agent.mjs` | Pro entry point (GitHub Actions runner) |
| `apps/ai-chat/src/App.jsx` | PWA: Chat UI + progress polling + deploy banner + result recovery |
| `apps/ai-chat/src/api.js` | Frontend: chatWithAI, fetchResult, pollProgress, fetchDeployStatus |
| `.jiiji/IDENTITY.md` | ตัวตน + สถาปัตยกรรม AI ครบชุด (อ่านก่อนแตะระบบ AI) |
| `JIIJI.md` | Flash identity + workflow 6 ขั้น (inject เข้า system prompt Flash) |

### Firestore Collections (AI ใช้)

| Collection / Doc | เขียนโดย | หน้าที่ |
|-----------------|----------|--------|
| `aiProgress/{requestId}` | Pro | step ปัจจุบัน — ai-chat poll ทุก 3 วิ |
| `aiResults/{requestId}` | Pro | ผลลัพธ์สุดท้าย (TTL 30 นาที) |
| `agentRunLogs/{requestId}/steps` | Pro | log ถาวรทุก iteration (debug) |
| `systemConfig/projectTree` | sync-project-tree.yml | โครงสร้าง repo ให้ Flash อ่าน |
| `systemConfig/agentDocs` | deploy-functions.yml | docs ให้ Flash อ่าน (JIIJI.md + AGENTS.md + handbook) |
| `system/deploy_status` | deployNotifyHttp | สถานะ deploy ล่าสุด — ai-chat แสดง banner |

### Quick Triggers (Flash bypass classifier — dispatch ทันที)

| พิมพ์ว่า | งาน |
|----------|-----|
| โอเคกุ้ง / ตรวจกุ้ง / auto-shrimp / เช็คกุ้ง | ตรวจสุขภาพ seafood-pos (อ่านอย่างเดียว) |
| โอเคชา / ตรวจชา / auto-tea / เช็คชา | ตรวจสุขภาพ chincha-tea (อ่านอย่างเดียว) |

> `normalizeThai()` swap tone mark ก่อนสระล่าง (ุ ู) ก่อน regex — รองรับ iPhone Unicode order ผิด

---

## Secrets ที่สำคัญ

| Secret | ที่เก็บ | ใช้งาน |
|--------|--------|-------|
| `OPENROUTER_API_KEY` | Google Cloud Secret Manager | Flash chat agent |
| `OPENROUTER_API_KEY_PRO` | GitHub Secrets | Pro agentic loop (ไม่ให้ Flash รู้) |
| `GH_PAT` | GitHub Secrets + `.env` (deploy only) | Pro เขียน repo + deployNotifyHttp auth |
| `GH_PAT_DISPATCH` | `.env` (Secret Manager) | Flash ส่ง dispatch เท่านั้น |
| `FIREBASE_SERVICE_ACCOUNT` | GitHub Secrets | CI scripts เขียน Firestore ตรง (sync-agent-docs, ack-pro-agent) |
| `VITE_FIREBASE_APP_ID_SHRIMP` | GitHub Secrets | build กุ้ง |
| `VITE_FIREBASE_APP_ID_TEA` | GitHub Secrets | build ชา |

⚠️ **token ต้องเป็น ASCII ล้วน** ห้ามมีอักขระพิเศษหรือ Thai ปน (ทำให้ ByteString error)  
⚠️ **X-Title header** ใน OpenRouter ต้องเป็น ASCII เท่านั้น (`(Jiji)` ไม่ใช่ `จีจี้`)

---

## Scripts CI สำคัญ

| Script | รันโดย | หน้าที่ |
|--------|--------|--------|
| `apps/webhook-core/scripts/sync-agent-docs.cjs` | `deploy-functions.yml` | sync docs → Firestore `systemConfig/agentDocs` |
| `apps/webhook-core/scripts/ack-pro-agent.cjs` | `ai-workflow-trigger.yml` | เขียน ACK → Firestore `agentProgress/{requestId}` |

ทั้งสองใช้ Service Account โดยตรง (`GOOGLE_APPLICATION_CREDENTIALS=/tmp/sa.json`) ไม่ผ่าน HTTP — หลีกเลี่ยง GH_PAT auth ที่เคย 401

---

## สิ่งที่มีอยู่แล้ว (อย่าสร้างซ้ำ)

ดูตาราง "สิ่งที่มีอยู่แล้ว" ใน `AGENTS.md` — ครอบคลุม smoke test, CI/CD, deploy skills ครบแล้ว

| ความต้องการ | ของเดิมใน monorepo |
|------------|-------------------|
| ตรวจ logic กุ้ง (ไม่ต้อง Firebase) | `node apps/seafood-pos/scripts/smoke-test.mjs` |
| ตรวจกุ้ง + รายงาน | skill `auto-shrimp` ใน `.claude/commands/` |
| deploy กุ้ง production | `deploy-hosting.yml` เมื่อ push `main` |
| ปิดงานกุ้ง (smoke → build → commit) | skill `ship-shrimp` |
| deploy ชา | `deploy-hosting.yml` (target tea) |
| ปิดงานชา | skill `ship-tea` |
| ปิดงาน PR | skill `land-it` |
| sync docs AI → Firestore | `sync-agent-docs.cjs` (รัน CI อัตโนมัติ) |

**ตัดสินแล้ว (ไม่ทำซ้ำ):**
- GitHub Actions CI รัน smoke + build บนทุก PR → ไม่จำเป็น (PR #127 ปิดโดยไม่ merge)
- auto-merge อัตโนมัติผ่าน `GITHUB_TOKEN` → ถูกลบออก (ทำให้ sync-project-tree ไม่รัน)

---

## ตรวจสุขภาพก่อน merge

```bash
node apps/seafood-pos/scripts/smoke-test.mjs   # logic กุ้ง
npm run build --workspace=seafood-pos           # ถ้าแตะแอปกุ้ง
npm run build --workspace=chincha-tea           # ถ้าแตะแอปชา
node --check apps/webhook-core/src/<file>.js   # syntax check ก่อน commit JS ใน webhook-core
```

---

## Deploy Workflows

push `main` → รันเฉพาะ workflow ที่ไฟล์เกี่ยวข้องเปลี่ยน:

| Workflow | trigger | ผลลัพธ์ |
|----------|---------|---------|
| `deploy-hosting.yml` | `apps/seafood-pos/**`, `apps/chincha-tea/**`, `apps/ai-chat/**` | Hosting + แจ้งสถานะ ai-chat |
| `deploy-functions.yml` | `apps/webhook-core/**` | Cloud Functions + sync agent docs → Firestore |
| `deploy-rules.yml` | `firestore*.rules`, `storage.rules` | Security rules + indexes |
| `pr-verify.yml` | ทุก PR | smoke test + build check |
| `ai-workflow-trigger.yml` | `repository_dispatch (ai-code-action)` | Pro agent agentic loop |
| `sync-project-tree.yml` | push `main` | sync PROJECT_STRUCTURE.md → Firestore |

Manual (GitHub Actions → Run workflow): `tea-db-reset.yml`, `shrimp-stock-reset.yml`, `shrimp-full-reset-on-demand.yml`

---

## Dev local

```bash
npm install
npm run dev:tea      # chincha-tea → port 5173 (binds ::1 ต้องใช้ http://[::1]:5173/)
npm run dev:seafood  # seafood-pos → 5173 --host 0.0.0.0 (ใช้ 127.0.0.1 ได้)
```

ต้องมี `apps/<app>/.env.local` (gitignored) กับ `VITE_FIREBASE_*` keys — ถ้าไม่มีจะ render ได้แต่ Firebase auth/Firestore ไม่ทำงาน

---

## Gotchas สำคัญ

- **`dev:tea` binds IPv6 loopback** — `curl http://127.0.0.1:5173` ล้มเหลว ใช้ `http://[::1]:5173/`
- **Restart Vite** หลังเปลี่ยน `.env.local` (อ่านตอน startup)
- **DSML strip** — DeepSeek V4 Flash generate `<|DSML|invoke>` XML เป็น text → strip ก่อน return ใน `aiChatAgent.js`
- **reasoning_content** — DeepSeek V4 Pro ต้องการ `reasoning_content` ทุก turn ของ assistant messages ใน multi-turn (ถ้าไม่ส่ง → OpenRouter 400)
- **ByteString error** — Node.js fetch() ห้ามใส่ตัวอักษรนอก Latin-1 ใน HTTP headers (`X-Title` ต้องเป็น ASCII)
- **package-lock.json** — ไม่ได้ commit ไว้ → `ai-workflow-trigger.yml` ใช้ `npm install` ไม่ใช่ `npm ci`
- **sync-project-tree.yml** ใช้ `DEPLOY_NOTIFY_URL` hardcode (URL สาธารณะ ไม่ใช่ secret)
- **`firestore-chincha.rules`** — กฎของ DB `chincha` (ข้อมูลเก่า) แยกจาก `firestore.rules` (default)
- **two Firestore databases**: `default` (กุ้ง + ชา + AI) และ `chincha` (เก่า)
