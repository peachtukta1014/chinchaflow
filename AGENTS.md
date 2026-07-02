# Agent instructions

> ไม่ใช้ Cursor Cloud Agent แล้ว (ย้ายมา Claude Code CLI เต็มตัว) — Agent Skills ทั้งหมดอยู่ที่ `.claude/commands/` (repo-wide: `peter-ser`, `land-it`, `auto-shrimp`, `auto-tea`, `ship-shrimp`, `ship-tea`) และ app-scoped `apps/*/.claude/skills/` (`run-seafood-pos`, `run-chincha-tea`, `run-ai-chat`, `run-webhook-core`) — โหลดผ่าน `get_skill`

## ก่อนเพิ่มของใหม่ — แจ้งเตือนถ้าไม่จำเป็น (บังคับสำหรับเอเจนต์)

เมื่อผู้ใช้หรือไอเดียจากแชทขอ **CI/CD ใหม่, workflow ใหม่, dependency ใหม่, สคริปต์ซ้ำ, หรือ infra ข้ามแอป** ให้ทำตามนี้ **ก่อนเขียนโค้ดหรือเปิด PR**:

1. **ค้นหาใน repo** ว่ามีทางเดิมแล้วหรือไม่ (`.github/workflows/`, `scripts/`, `.claude/commands/`, `apps/*/.claude/skills/`, `AGENTS.md`, `docs/`).
2. **ถ้ามีทางเดิมครอบคลุมแล้ว** — หยุด implement; **แจ้งผู้ใช้ชัดเจน** ว่า:
   - ระบบมีอะไรอยู่แล้ว (คำสั่ง / skill / workflow)
   - ทำไมการเพิ่มซ้ำ **ไม่จำเป็น** หรือ **เสี่ยง** (ความซับซ้อน, secret, เวลา CI, deploy ซ้ำซ้อน)
   - **ทางแนะนำ** ที่ใช้ได้ทันที
3. **ลงมือเพิ่ม** เฉพาะเมื่อผู้ใช้ยืนยันหลังได้คำเตือนแล้ว (เช่น “ทำเลย”, “merge ได้”, “ไม่เอา smoke มือให้ CI”).

### สิ่งที่มีอยู่แล้ว (อ้างอิงเร็ว)

| ความต้องการ | ของเดิมใน monorepo | หมายเหตุ |
|-------------|-------------------|----------|
| ตรวจ logic กุ้ง (ไม่ต้อง Firebase) | `node apps/seafood-pos/scripts/smoke-test.mjs` | ใช้ก่อน merge / ในแชท agent |
| ตรวจกุ้ง + รายงาน | skill `auto-shrimp` (`.claude/commands/auto-shrimp.md`) | ไม่แก้โค้ดถ้าแค่เช็กสุขภาพ |
| build / deploy กุ้ง production | `deploy-hosting.yml` เมื่อ push `main` | **ไม่มี** PR CI smoke ตามนโยบายทีม (ไม่จำเป็น — smoke มือ/skill พอ) |
| ปิดงานกุ้ง (smoke → build → merge main → deploy) | skill `ship-shrimp` (`.claude/commands/ship-shrimp.md`) | หลัง PR พร้อม |
| deploy ชา | `deploy-hosting.yml` (target tea) | |
| ปิดงานชา (build → merge main → deploy) | skill `ship-tea` (`.claude/commands/ship-tea.md`) | หลัง PR พร้อม; build = smoke ชา |
| deploy rules / functions | `deploy-rules.yml`, `deploy-functions.yml` | |
| ปิดงาน PR | skill `land-it` | |
| sync docs AI เข้า Firestore | `apps/webhook-core/scripts/sync-agent-docs.cjs` | รัน CI หลัง deploy functions อัตโนมัติ (ไม่ต้องรันมือ) |
| ACK Pro Agent กลับ UI | `apps/webhook-core/scripts/ack-pro-agent.cjs` | รัน `ai-workflow-trigger.yml` อัตโนมัติเมื่อ Pro ตื่น |
| ส่ง Pro Agent ทำงาน | พิมพ์ **"โอเคกุ้ง"** หรือ **"โอเคชา"** ใน ai-chat (จีจี้) | Flash → dispatch → `ai-workflow-trigger.yml` → Pro loop |
| รัน/screenshot กุ้ง | `get_skill("run-seafood-pos")` | vite dev + chromium + smoke-test.mjs |
| รัน/screenshot ชา | `get_skill("run-chincha-tea")` | vite dev + chromium screenshot |
| รัน/screenshot ai-chat | `get_skill("run-ai-chat")` | vite dev + chromium screenshot |
| syntax check webhook-core | `get_skill("run-webhook-core")` | node --check ทุก .js ใน src/ |
| เทส logic webhook-core (ไม่ต้อง key) | `apps/webhook-core/scripts/test-*.js` | รันอัตโนมัติใน `pr-verify.yml` ทุก PR ที่แตะ webhook-core |
| สอบ AI classifier (ยิง LLM จริง) | `apps/webhook-core/scripts/eval-flash-intents.mjs` + `ai-eval.yml` | ต้อง `OPENROUTER_API_KEY`; CI รันอัตโนมัติเมื่อ PR แตะ `flash/`/`aiChatAgent.js` แล้วโพสต์ตารางผลใน PR |

### ตัวอย่างที่ทีมตัดสินแล้ว (ไม่ทำซ้ำ)

- **GitHub Actions CI** รัน smoke + build กุ้งบนทุก PR — **ไม่จำเป็น**: มี smoke script + skill `auto-shrimp` + deploy บน `main` อยู่แล้ว; PR #127 ปิดโดยไม่ merge.

## กฎ changelog — บังคับสำหรับ AI ทุกตัวที่แก้โค้ด (Pro Agent + Claude Code)

> Flash (จีจี้) ไม่แก้โค้ด — ไม่ต้องทำ

1. **อ่าน `docs/AGENT_CHANGELOG_TH.md` ก่อนลงมือทุกครั้ง** ดูว่ารอบก่อนแก้อะไรไปแล้ว ป้องกันแก้ซ้ำหรือ conflict กัน
2. **ห้ามเขียน/แก้ `docs/AGENT_CHANGELOG_TH.md` หรือ `apps/<app>/CHANGELOG.md` เอง** — `.github/workflows/auto-changelog.yml` เขียนให้อัตโนมัติตอน PR merge (repo-wide + per-app ตามไฟล์ที่ PR แตะ) หน้าที่ของ AI คือแค่**อ่านก่อนแก้** ไม่ใช่บันทึกเอง (เดิมให้เขียนเองด้วย ทำให้เกิด entry ซ้ำซ้อนกับที่ workflow เขียนตอน merge — ยกเลิกแล้ว 2026-07)

## เอกสารให้เอเจนต์ (อ่านทุกรอบ)

| เอกสาร | หน้าที่ |
|--------|---------|
| `docs/AGENT_HANDBOOK_TH.md` | แผนที่ repo + กฎอัปเดต docs หลังเปลี่ยนโครงสร้าง |
| `docs/PEACH_WORKING_STYLE_TH.md` | Peach สั่งงานภาษาพูด — พี่เซอทบทวนก่อนลงมือ |
| `docs/AGENT_CHANGELOG_TH.md` | รอบก่อนแก้อะไร — **อ่านก่อนไล่บั๊ก** · เพิ่มหลัง merge |
| `docs/ARCHITECTURE_TH.md` | สถาปัตยกรรม, Firestore, deploy |
| `docs/PROJECT_STRUCTURE.md` | โฟลเดอร์/ไฟล์สำคัญ |
| `docs/AI_AGENT_SYSTEM.md` | สถาปัตยกรรม AI ครบชุด (Flash/Pro/keys/flow) |
| `FLASH.md` · `PRO.md` | ตัวตน + workflow ของ Flash/Pro Agent |

