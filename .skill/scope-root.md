# Scope Guard — root (ทั้งระบบ / infrastructure)

> ใช้เมื่องานแตะหลาย scope หรือเป็น infrastructure: docs, CI/CD, Firestore rules, AI agent config

## แตะได้ ✅
- `CLAUDE.md`, `AGENTS.md`, `PRO.md`, `FLASH.md`
- `docs/` — เอกสารทีมและสถาปัตยกรรม
- `.github/workflows/` — CI/CD workflows
- `firestore.rules`, `firestore-chincha.rules`, `firestore.indexes.json`, `storage.rules`
- `package.json` (root), `firebase.json`, `.firebaserc`
- อ่านไฟล์จากทุก scope ได้ แต่แก้ app code เฉพาะถ้างานกำหนดชัดเจน

## ห้ามแตะ ❌ (เว้นแต่ได้รับมอบหมายชัดเจน)
- app code ใดๆ โดยไม่จำเป็น — ถ้างานต้องการแก้ `apps/seafood-pos/` → ให้ scope=seafood แทน

## ตรวจสุขภาพก่อน commit
- YAML workflows: ตรวจ indent ให้ถูกต้อง (YAML strict)
- Firestore rules: ไม่มี auto-check — ตรวจ logic ด้วยตา
- AI docs: ตรวจค่าตัวเลขตรงกับโค้ดจริง (MAX_ITERATIONS=22, CHECKPOINT_INTERVAL=7 — ดู `agentTools.js`)

## Gotchas สำคัญ
- **sync-agent-docs.cjs** รัน CI อัตโนมัติหลัง `deploy-functions.yml` — ไม่ต้อง sync manual
- **docs/AI_AGENT_SYSTEM.md + PRO.md** ต้อง sync กับ `agentTools.js` เสมอถ้าแก้ค่าตัวเลข — มี `sync-ai-constants.yml` auto-sync ให้แล้ว (trigger เมื่อแก้ `agentTools.js`)
- **`PROJECT_STRUCTURE.md`** อัปเดตอัตโนมัติผ่าน `sync-project-tree.yml` — ไม่ต้องแก้ manual (แต่ถ้าเพิ่ม folder หลัก → อัปเดตในงานเดียวกันได้)
- **`docs/AGENT_CHANGELOG_TH.md` + `apps/<app>/CHANGELOG.md`** อัปเดตอัตโนมัติผ่าน `auto-changelog.yml` ตอน PR merge — ห้ามเขียนเอง
- **scope-root = เปิดกว้าง** — ระวังแก้ CI ที่กระทบทุก app ให้ทดสอบ logic ด้วยตาก่อน merge
