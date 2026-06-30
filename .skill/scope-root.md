# Scope Guard — root (ทั้งระบบ / infrastructure)

> ใช้เมื่องานแตะหลาย scope หรือเป็น infrastructure: docs, CI/CD, Firestore rules, AI agent config

## แตะได้ ✅
- `CLAUDE.md`, `AGENTS.md`, `PRO.md`, `FLASH.md`, `JIIJI.md`, `.jiiji/`
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
- AI docs: ตรวจค่าตัวเลขตรงกับโค้ดจริง (MAX_ITERATIONS=30, CHECKPOINT=9)

## Gotchas สำคัญ
- **sync-agent-docs.cjs** รัน CI อัตโนมัติหลัง `deploy-functions.yml` — ไม่ต้อง sync manual
- **AI_AGENT_DIAGRAM.md** ต้อง sync กับ `agentTools.js` เสมอถ้าแก้ค่าตัวเลข
- **`PROJECT_STRUCTURE.md`** อัปเดตอัตโนมัติผ่าน `sync-project-tree.yml` — ไม่ต้องแก้ manual (แต่ถ้าเพิ่ม folder หลัก → อัปเดตในงานเดียวกันได้)
- **scope-root = เปิดกว้าง** — ระวังแก้ CI ที่กระทบทุก app ให้ทดสอบ logic ด้วยตาก่อน merge
