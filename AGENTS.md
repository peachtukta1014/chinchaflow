# Agent instructions

## Cursor Cloud Agent (Slack / cursor.com/agents)

- **Peter (พี่เซอ):** ผู้ใช้เรียกเอเจนต์ว่า **พี่เซอ** — โทนเพื่อนร่วมงาน senior full-stack ภาษาไทยได้ · ตำแหน่งใน repo = Senior Full-stack ดูแลชา + กุ้ง · รายละเอียด skill `.cursor/skills/peter-ser/` (`/peter-ser`)
- **Setup checklist (ไทย):** `docs/CURSOR_AGENT_SETUP_TH.md` — ขั้น 1 Dashboard, 2 `@cursor settings`, 3 `.cursor/environment.json`, 4 ทดสอบ
- **Slack รับงาน:** `#chincha-tea-agent` (ชา) · `#chincha-shrimp-agent` (กุ้ง) — แยก session ต่อแอป
- **กุ้ง:** `apps/seafood-pos` · **ชา:** `apps/chincha-tea` · **LINE functions:** `apps/webhook-core`
- Slack default model: **Claude 4.6 Sonnet** (Dashboard → Cloud Agents → My Settings). Composer in Slack: `@cursor with composer, …`
- Dependencies on boot: `npm install` (see `.cursor/environment.json`)
- **Agent Skills (monorepo):** repo-wide `.cursor/skills/` (`peter-ser`, `land-it`) · app-scoped `apps/seafood-pos/.cursor/skills/` (`auto-shrip`, `deploy-shrimp`, `ship-shrimp`) · `apps/chincha-tea/.cursor/skills/` (`auto-tea`, `deploy-tea`, `ship-tea`). Nested skills auto-apply only when working under that app directory.

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
| ปิดงานกุ้ง (smoke → build → merge main → deploy) | skill `ship-shrimp` (`/ship-shrimp` หรือพูด **โอเค/แอปกุ้ง**) | หลัง PR พร้อม |
| deploy ชา | `deploy-hosting.yml` (target tea) · skill `deploy-tea` | |
| ปิดงานชา (build → merge main → deploy) | skill `ship-tea` (`/ship-tea` หรือพูด **โอเค/ชินชา**) | หลัง PR พร้อม; build = smoke ชา |
| deploy rules / functions | `deploy-rules.yml`, `deploy-functions.yml` | |
| ปิดงาน PR | skill `land-it` | |

### ตัวอย่างที่ทีมตัดสินแล้ว (ไม่ทำซ้ำ)

- **GitHub Actions CI** รัน smoke + build กุ้งบนทุก PR — **ไม่จำเป็น**: มี smoke script + `auto-shrip` + deploy บน `main` อยู่แล้ว; PR #127 ปิดโดยไม่ merge.

## เอกสารให้เอเจนต์ (อ่านทุกรอบ)

| เอกสาร | หน้าที่ |
|--------|---------|
| `docs/AGENT_HANDBOOK_TH.md` | แผนที่ repo + กฎอัปเดต docs หลังเปลี่ยนโครงสร้าง |
| `docs/PEACH_WORKING_STYLE_TH.md` | Peach สั่งงานภาษาพูด — พี่เซอทบทวนก่อนลงมือ |
| `docs/AGENT_CHANGELOG_TH.md` | รอบก่อนแก้อะไร — **อ่านก่อนไล่บั๊ก** · เพิ่มหลัง merge |
| `docs/ARCHITECTURE_TH.md` | สถาปัตยกรรม, Firestore, deploy |
| `docs/PROJECT_STRUCTURE.md` | โฟลเดอร์/ไฟล์สำคัญ |

เมื่อ PR เปลี่ยน collection, โมดูล LINE, หรือ config สำคัญ — แก้ section ที่เกี่ยวในเอกสารด้านบนใน PR เดียวกัน (ไม่ copy ทั้ง repo ลงไฟล์ใหม่)

## Cursor Cloud specific instructions

### Product overview

**CHINCHA FLOW** — business operations platform (POS + inventory + CRM + LINE), not POS-only.  
Brand name: **CHINCHA FLOW** · Repo: **chincha-business-os** · Cloud: Firebase `chincha-eeed6`.  
Naming reference: `docs/CHINCHA_FLOW_NAMING_TH.md`

Firebase monorepo with two Vite/React PWAs:

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

### Cloud Agent Secrets (cursor.com → Dashboard → Cloud Agents → Secrets)

Peach maintains these in the Dashboard (copy values from **GitHub → repo → Settings → Secrets** — same names where possible). **Do not guess** Firebase config; read from env or ask Peach.

| Secret name (Dashboard) | Used for |
|-------------------------|----------|
| `VITE_FIREBASE_API_KEY` | both apps |
| `VITE_FIREBASE_AUTH_DOMAIN` | both apps |
| `VITE_FIREBASE_DATABASE_URL` | both apps (may be empty) |
| `VITE_FIREBASE_PROJECT_ID` | `chincha-eeed6` |
| `VITE_FIREBASE_STORAGE_BUCKET` | both apps |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | both apps |
| `VITE_FIREBASE_APP_ID_SHRIMP` | กุ้ง — maps to `VITE_FIREBASE_APP_ID` in `apps/seafood-pos/.env.local` |
| `VITE_FIREBASE_APP_ID_TEA` | ชา — maps to `VITE_FIREBASE_APP_ID` in `apps/chincha-tea/.env.local` |
| `SHRIMP_AGENT_EMAIL` | E2E กุ้ง (e.g. `peachtukta1014@gmail.com`) |
| `SHRIMP_AGENT_PASSWORD` | E2E กุ้ง — Dashboard only, never Slack/git |
| `TEA_AGENT_EMAIL` | E2E ชา (bootstrap: `gmc-peach@chincha.pos` or `peachtukta1014@gmail.com`) |
| `TEA_AGENT_PASSWORD` | E2E ชา — Dashboard only |

Before build/dev that needs Firebase, materialize `.env.local` from secrets (Cloud Agent session):

```bash
# กุ้ง
cat > apps/seafood-pos/.env.local <<EOF
VITE_FIREBASE_API_KEY=${VITE_FIREBASE_API_KEY}
VITE_FIREBASE_AUTH_DOMAIN=${VITE_FIREBASE_AUTH_DOMAIN}
VITE_FIREBASE_DATABASE_URL=${VITE_FIREBASE_DATABASE_URL}
VITE_FIREBASE_PROJECT_ID=${VITE_FIREBASE_PROJECT_ID}
VITE_FIREBASE_STORAGE_BUCKET=${VITE_FIREBASE_STORAGE_BUCKET}
VITE_FIREBASE_MESSAGING_SENDER_ID=${VITE_FIREBASE_MESSAGING_SENDER_ID}
VITE_FIREBASE_APP_ID=${VITE_FIREBASE_APP_ID_SHRIMP}
EOF

# ชา
cat > apps/chincha-tea/.env.local <<EOF
VITE_FIREBASE_API_KEY=${VITE_FIREBASE_API_KEY}
VITE_FIREBASE_AUTH_DOMAIN=${VITE_FIREBASE_AUTH_DOMAIN}
VITE_FIREBASE_DATABASE_URL=${VITE_FIREBASE_DATABASE_URL}
VITE_FIREBASE_PROJECT_ID=${VITE_FIREBASE_PROJECT_ID}
VITE_FIREBASE_STORAGE_BUCKET=${VITE_FIREBASE_STORAGE_BUCKET}
VITE_FIREBASE_MESSAGING_SENDER_ID=${VITE_FIREBASE_MESSAGING_SENDER_ID}
VITE_FIREBASE_APP_ID=${VITE_FIREBASE_APP_ID_TEA}
EOF
```

After adding or changing Dashboard secrets, **start a new Cloud Agent session** (old sessions do not pick up new secrets).

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
