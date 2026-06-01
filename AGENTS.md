# Agent instructions

## Cursor Cloud Agent (Slack / cursor.com/agents)

- **Setup checklist (ไทย):** `docs/CURSOR_AGENT_SETUP_TH.md` — ขั้น 1 Dashboard, 2 `@cursor settings`, 3 `.cursor/environment.json`, 4 ทดสอบ
- **Slack รับงาน:** `#chincha-tea-agent` (ชา) · `#chincha-shrimp-agent` (กุ้ง) — แยก session ต่อแอป
- **กุ้ง:** `apps/seafood-pos` · **ชา:** `apps/chincha-tea` · **LINE functions:** `apps/webhook-core`
- Slack default model: **Claude 4.6 Sonnet** (Dashboard → Cloud Agents → My Settings). Composer in Slack: `@cursor with composer, …`
- Dependencies on boot: `npm install` (see `.cursor/environment.json`)
- **Agent Skills (monorepo):** repo-wide `.cursor/skills/` (e.g. `land-it`) · app-scoped `apps/seafood-pos/.cursor/skills/` (`auto-shrip`, `deploy-shrimp`) · `apps/chincha-tea/.cursor/skills/` (`deploy-tea`). Nested skills auto-apply only when working under that app directory.

## ก่อนเพิ่มของใหม่ — แจ้งเตือนถ้าไม่จำเป็น (บังคับสำหรับเอเจนต์)

เมื่อผู้ใช้หรือไอเดียจากแชทขอ **CI/CD ใหม่, workflow ใหม่, dependency ใหม่, สคริปต์ซ้ำ, หรือ infra ข้ามแอป** ให้ทำตามนี้ **ก่อนเขียนโค้ดหรือเปิด PR**:

1. **ค้นหาใน repo** ว่ามีทางเดิมแล้วหรือไม่ (`.github/workflows/`, `scripts/`, `.cursor/skills/`, `AGENTS.md`, `docs/`).
2. **ถ้ามีทางเดิมครอบคลุมแล้ว** — หยุด implement; **แจ้งผู้ใช้ชัดเจน** ว่า:
   - ระบบมีอะไรอยู่แล้ว (คำสั่ง / skill / workflow)
   - ทำไมการเพิ่มซ้ำ **ไม่จำเป็น** หรือ **เสี่ยง** (ความซับซ้อน, secret, เวลา CI, deploy ซ้ำซ้อน)
   - **ทางแนะนำ** ที่ใช้ได้ทันที
3. **ลงมือเพิ่ม** เฉพาะเมื่อผู้ใช้ยืนยันหลังได้คำเตือนแล้ว (เช่น “ทำเลย”, “merge ได้”, “ไม่เอา smoke มือให้ CI”).

### สิ่งที่มีอยู่แล้ว (อ้างอิงเร็ว)

| ความต้องการ | ของเดิมใน monorepo | หมายเหตุ |
|-------------|-------------------|----------|
| ตรวจ logic กุ้ง (ไม่ต้อง Firebase) | `node apps/seafood-pos/scripts/smoke-test.mjs` | ใช้ก่อน merge / ในแชท agent |
| ตรวจกุ้ง + รายงาน Slack | skill `auto-shrip` (`/auto-shrip`) | ไม่แก้โค้ดถ้าแค่เช็กสุขภาพ |
| build / deploy กุ้ง production | `deploy-hosting.yml` เมื่อ push `main` · skill `deploy-shrimp` | **ไม่มี** PR CI smoke ตามนโยบายทีม (ไม่จำเป็น — smoke มือ/skill พอ) |
| deploy ชา | `deploy-hosting.yml` (target tea) · skill `deploy-tea` | |
| deploy rules / functions | `deploy-rules.yml`, `deploy-functions.yml` | |
| ปิดงาน PR | skill `land-it` | |

### ตัวอย่างที่ทีมตัดสินแล้ว (ไม่ทำซ้ำ)

- **GitHub Actions CI** รัน smoke + build กุ้งบนทุก PR — **ไม่จำเป็น**: มี smoke script + `auto-shrip` + deploy บน `main` อยู่แล้ว; PR #127 ปิดโดยไม่ merge.

## Cursor Cloud specific instructions

### Product overview

Firebase monorepo (`chincha-eeed6`) with two Vite/React PWAs:

- **Tea POS** — `apps/chincha-tea` (`npm run dev:tea`, default http://localhost:5173)
- **Shrimp POS** — `apps/seafood-pos` (`npm run dev:seafood`, Vite `--host 0.0.0.0`)
- **LINE webhooks** — `apps/webhook-core` (deploy-only Cloud Functions; no local HTTP server)

There is no docker-compose and no Firebase Emulator setup. Local dev talks to the **live** Firebase project.

### Dependencies

From repo root:

```bash
npm install
```

Node **>= 20** (root `package.json`). `webhook-core` workspaces declare `node: 20` exactly; Node 22 works but prints `EBADENGINE` warnings.

### Environment variables

Each app needs `apps/<app>/.env.local` (gitignored) with `VITE_FIREBASE_*` keys. CI uses GitHub Actions secrets; see `.github/workflows/deploy-hosting.yml` for the variable names. Tea and shrimp use **different** `VITE_FIREBASE_APP_ID` values.

Without these vars, the login UI still renders but Firebase Auth/Firestore calls fail (`storageNotReady` on submit).

### Verify without cloud login

Logic-only regression (no Firebase):

```bash
node apps/seafood-pos/scripts/smoke-test.mjs
```

Production builds (no `.env` required at build time, but runtime needs env for auth):

```bash
npm run build --workspace=chincha-tea
npm run build --workspace=seafood-pos
```

### Lint / test

No ESLint or root `npm test` script. CI only runs deploy workflows on `main`. Use the smoke test above for automated checks.

### Dev servers

Start in tmux (long-running):

```bash
npm run dev:tea      # chincha-tea → port 5173 (or next free port)
npm run dev:seafood  # seafood-pos → 5173 with --host 0.0.0.0
```

If port 5173 is busy, Vite picks the next port; check the Vite banner in the terminal.

### Full E2E (login, orders, Firestore)

Requires live Firebase + approved user in Firestore (`users/{uid}` with `approved: true`). Bootstrap admin email for tea is documented in `apps/chincha-tea/src/lib/constants.js` (`BOOTSTRAP_ADMIN_EMAIL`). Use your own credentials (Cloud Agent Secrets or local `.env.local`); do not commit `.env.local`.

### Gotchas

- Restart Vite after changing `.env.local` (env is read at dev-server startup).
- `npm install` at repo root installs all workspaces including `webhook-core` (large `firebase-functions` tree).
- LINE push / webhook E2E needs deployed functions in `asia-southeast1`, not local `npm start` in `webhook-core`.
