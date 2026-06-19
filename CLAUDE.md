# CLAUDE.md — กฎการทำงานของ Claude Code (พี่ซี) ในโปรเจกต์นี้

อ่านเอกสารด้านล่างก่อนลงมือทุกครั้ง เรียงตามลำดับสำคัญ:

1. `AGENTS.md` — กฎ monorepo, ของที่มีอยู่แล้ว, อย่าเพิ่มซ้ำ
2. `docs/PEACH_WORKING_STYLE_TH.md` — วิธีพี่ (Peach) สั่งงาน, คำศัพท์, ทบทวนก่อนลงมือ
3. `docs/AGENT_HANDBOOK_TH.md` — แผนที่ repo, กฎอัปเดต docs
4. `docs/AGENT_CHANGELOG_TH.md` — รอบก่อนแก้อะไร — อ่านก่อนไล่บั๊กทุกครั้ง

## กฎหลัก

- **อ่านก่อนเขียน** — ใช้ Read tool อ่านไฟล์จริงก่อนทุกครั้ง ห้ามเดาเนื้อไฟล์
- **diff เล็กที่สุด** — แก้เฉพาะส่วนที่เกี่ยวกับงาน ห้ามแตะส่วนอื่นโดยไม่จำเป็น
- **เปิด PR เสมอ** — ห้าม push ตรง main ทุกกรณี พัฒนาบน branch แล้วเปิด PR draft
- **บันทึกทุกการแก้** — หลัง merge แต่ละรอบ เพิ่ม entry ใน `docs/AGENT_CHANGELOG_TH.md`
- **อย่าเพิ่มซ้ำ** — ตรวจ `AGENTS.md` ก่อนว่ามีทางเดิมอยู่แล้วหรือไม่
- **ทบทวนก่อนลงมือ** (ถ้างานไม่ชัด) — สรุปกลับสั้นๆ รอพี่ยืนยันก่อนเปิด PR ใหญ่

## Branch & Commit convention

- Branch: `dev/ai-fix-<คำอธิบายสั้นๆ>` หรือ `claude/<session-id>`
- Commit: `fix/feat/docs: <อธิบายสั้นๆ ภาษาไทยหรืออังกฤษ>`

## สิ่งที่มีอยู่แล้ว (อย่าสร้างซ้ำ)

ดูตาราง "สิ่งที่มีอยู่แล้ว" ใน `AGENTS.md` — ครอบคลุม smoke test, CI/CD, deploy skills ครบแล้ว

## โครงสร้าง repo (สรุป)

- `apps/chincha-tea/` — Tea POS (Vite/React)
- `apps/seafood-pos/` — Shrimp POS (Vite/React)
- `apps/webhook-core/` — LINE backend + AI agent (Cloud Functions Node 20)
- `apps/ai-chat/` — AI admin chat PWA
- `.github/workflows/` — CI/CD (deploy + pr-verify)

## ตรวจสุขภาพก่อน merge

```bash
node apps/seafood-pos/scripts/smoke-test.mjs   # logic กุ้ง
npm run build --workspace=seafood-pos           # ถ้าแตะแอปกุ้ง
npm run build --workspace=chincha-tea           # ถ้าแตะแอปชา
```
