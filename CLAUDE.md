# CLAUDE.md — กฎการทำงานของ Claude Code (พี่ซี) ในโปรเจกต์นี้

> **พี่ซี** = Claude Code — ทำงานผ่านมือถือ 100% ไม่มีเครื่องคอม ไม่มี terminal ฝั่งพีช

อ่านเอกสารด้านล่างก่อนลงมือทุกครั้ง เรียงตามลำดับสำคัญ:

1. `AGENTS.md` — กฎ monorepo, ของที่มีอยู่แล้ว, อย่าเพิ่มซ้ำ
2. `docs/PEACH_WORKING_STYLE_TH.md` — วิธีพี่พีช (Peach) สั่งงาน, คำศัพท์, ทบทวนก่อนลงมือ
3. `docs/AGENT_HANDBOOK_TH.md` — แผนที่ repo, กฎอัปเดต docs
4. `docs/AGENT_CHANGELOG_TH.md` — รอบก่อนแก้อะไร — อ่านก่อนไล่บั๊กทุกครั้ง

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

## Branch & Commit convention

- Branch: `dev/ai-fix-<คำอธิบายสั้นๆ>` หรือ `claude/<session-id>`
- Commit: `fix/feat/docs: <อธิบายสั้นๆ ภาษาไทยหรืออังกฤษ>`

## ระบบ AI ของโปรเจกต์ (ห้ามสับสน)

| ตัวละคร | ชื่อเล่น | รัน | หน้าที่ |
|--------|---------|-----|--------|
| Claude Code | **พี่ซี** | Claude.ai/code (web/mobile) | แก้โค้ด เปิด PR ตาม spec จากพีชพีช |
| Flash Agent (`aiChatAgentHttp`) | **จีจี้** | Firebase Cloud Functions | รับแชท → ตอบ → ส่ง dispatch ให้โปร |
| Pro Agent (`run-github-agent.mjs`) | **ตัวโปร** | GitHub Actions (`ai-workflow-trigger.yml`) | รับ dispatch → แก้โค้ดอัตโนมัติ → push PR |

**Secrets ที่สำคัญ (GitHub Secrets → bake ลง Firebase `.env` ตอน deploy):**
- `GH_PAT` — scope: `repo` + `workflow` — Pro Agent ใช้เขียนโค้ด push PR
- `GH_PAT_DISPATCH` — scope: `repo` + `workflow` — Flash ใช้ส่ง dispatch ไป GitHub เท่านั้น
- ⚠️ token ต้องเป็น ASCII ล้วน ห้ามมีอักขระพิเศษหรือ Thai ปน (ทำให้ ByteString error)

**Scripts CI (ใช้ Service Account โดยตรง ไม่ผ่าน HTTP):**
- `apps/webhook-core/scripts/sync-agent-docs.cjs` — sync docs → Firestore `systemConfig/agentDocs`
- `apps/webhook-core/scripts/ack-pro-agent.cjs` — เขียน ACK → Firestore `agentProgress/{requestId}`

## สิ่งที่มีอยู่แล้ว (อย่าสร้างซ้ำ)

ดูตาราง "สิ่งที่มีอยู่แล้ว" ใน `AGENTS.md` — ครอบคลุม smoke test, CI/CD, deploy skills ครบแล้ว

## โครงสร้าง repo (สรุป)

- `apps/chincha-tea/` — Tea POS (Vite/React)
- `apps/seafood-pos/` — Shrimp POS (Vite/React)
- `apps/webhook-core/` — LINE backend + AI agent (Cloud Functions Node 20)
- `apps/ai-chat/` — AI admin chat PWA (จีจี้ UI)
- `.github/workflows/` — CI/CD (deploy + pr-verify + ai-workflow-trigger)

## ตรวจสุขภาพก่อน merge

```bash
node apps/seafood-pos/scripts/smoke-test.mjs   # logic กุ้ง
npm run build --workspace=seafood-pos           # ถ้าแตะแอปกุ้ง
npm run build --workspace=chincha-tea           # ถ้าแตะแอปชา
```
