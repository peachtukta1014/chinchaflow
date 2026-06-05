# ตั้งค่า Cursor Agent (กุ้ง + ชา) — ทำครั้งเดียว

คู่มือสั้น ๆ หลังตั้ง **แผน Ultimate** และเปิดโมเดลใน Settings แล้วยังงง — ทำตามลำดับ **1 → 2 → 3 → 4** ด้านล่าง

---

## สรุปก่อน (ไม่ต้องจำยาว)

| ที่ใช้ | โมเดลหลักที่แนะนำ | หมายเหตุ |
|--------|-------------------|----------|
| **Slack** `@cursor` | **Claude 4.6 Sonnet** | ตั้งใน Dashboard ครั้งเดียว |
| **IDE — แท็บ Agent** | Sonnet 4.6 *หรือ* Composer 2.5 ตามชอบ | เลือกใน dropdown แต่ละแท็บ |
| **IDE — แท็บ Ask** | Composer 2.5 | ถามเร็ว ๆ / ประหยัด quota |
| **Slack อยากใช้ Composer** | พิมพ์ `with composer` | ไม่มีปุ่ม default แยกใน Slack |

ระบบรวมชื่อ **CHINCHA FLOW** · repo เทคนิค **chincha-business-os** (GitHub ~`chincha-tea-Privately-`) — ชา + กุ้ง + LINE · ดู [CHINCHA_FLOW_NAMING_TH.md](./CHINCHA_FLOW_NAMING_TH.md)

---

## 1) Dashboard — Cloud Agents → My Settings

เปิด: [cursor.com/dashboard](https://cursor.com/dashboard) → **Cloud Agents** → **My Settings**

| ช่อง | ค่าที่แนะนำ |
|------|-------------|
| **Default Model** | **Claude 4.6 Sonnet** |
| **Default repository** | repo monorepo นี้ (`chincha-tea-Privately-`) |
| **Base branch** | `main` |

บันทึกแล้วปิด — **ไม่ต้อง**มาตั้งซ้ำทุกครั้งที่แชท Slack

> ถ้าเคยตั้ง **Agent ใน IDE = Composer 2.5** (เช่น สีม่วง Ultimate) — **ไม่ขัดกัน** กับข้อ 1: ข้อ 1 ใช้กับ **Slack / Cloud Agent บนเว็บ** เท่านั้น

---

## 2) Slack — ช่องรับงานแยกแอป (แนะนำ)

| ช่อง | แอป | โฟลเดอร์ |
|------|-----|----------|
| `#chincha-tea-agent` | ชา | `apps/chincha-tea` |
| `#chincha-shrimp-agent` | กุ้ง | `apps/seafood-pos` |

ใน **แต่ละช่อง** พิมพ์ครั้งเดียว:

```text
@cursor settings
```

เลือก **default repository** = monorepo chincha (ชื่อเดียวกับใน GitHub)

หลังนี้สั่งงานใน channel นั้น — agent จะอ่าน `AGENTS.md` ในแอปนั้น และ thread ไม่ปนกันระหว่างชากับกุ้ง

ช่อง `#chincha-flow` = ประสานงานภาพรวม **CHINCHA FLOW** (ชื่อระบบรวม)

**งานกุ้งชัด ๆ** (ถ้า agent ไป repo ผิด):

```text
@cursor ใน seafood-pos, [คำสั่งงาน]
```

**อยากใช้ Composer ใน Slack:**

```text
@cursor with composer, [คำสั่งงาน]
```

---

## 3) Repo — Skills + environment (ใน git)

### Skills (monorepo)

โปรเจกต์นี้ทำคนเดียว — ช่อง Slack (`#chincha-tea-agent`, `#chincha-shrimp-agent`) คือที่สั่ง Cursor แทนทีม ไม่ต้องมี Notion แยก จุดอ้างอิงคำสั่งคือตารางด้านล่าง + ไฟล์ `SKILL.md` ใน repo

Cursor โหลด skills จากโฟลเดอร์ `.cursor/skills/` อัตโนมัติ — ใน monorepo วางแบบนี้:

```text
chincha/
├── .cursor/skills/              # ทั้ง repo (เช่น peter-ser, land-it)
│   ├── peter-ser/SKILL.md       # Peter / พี่เซอ — senior full-stack ชา+กุ้ง
│   └── land-it/SKILL.md
├── apps/seafood-pos/.cursor/skills/   # เฉพาะกุ้ง
│   ├── auto-shrip/SKILL.md
│   └── deploy-shrimp/SKILL.md
└── apps/chincha-tea/.cursor/skills/   # เฉพาะชา
    └── deploy-tea/SKILL.md
```

- Skills ใต้ `apps/seafood-pos/` จะโผล่เมื่อ agent ทำงานกับไฟล์ในแอปกุ้งเท่านั้น (คล้าย scope ของช่อง `#chincha-shrimp-agent`)
- เรียกเองในแชท: พิมพ์ `/` แล้วเลือกชื่อ skill (เช่น `/auto-shrip`, `/deploy-shrimp`, `/land-it`)

| เรียก | ช่อง Slack | ทำอะไร |
|--------|------------|--------|
| `/peter-ser` | ทั้ง repo | persona เอเจนต์ **Peter (พี่เซอ)** · senior full-stack ชา+กุ้ง |
| `/auto-shrip` | `#chincha-shrimp-agent` | smoke + build กุ้ง + รายงาน |
| `/deploy-shrimp` | `#chincha-shrimp-agent` | verify + คู่มือ deploy → ko-seafood.top |
| `/deploy-tea` | `#chincha-tea-agent` | build + คู่มือ deploy → chincha-tea.web.app |
| `/land-it` | ทั้ง repo | verify → commit → push → PR |

- เอกสาร Cursor: [cursor.com/docs/skills](https://cursor.com/docs/skills)

### Environment


ไฟล์ `.cursor/environment.json` บอก agent ให้รัน `npm install` ก่อนงาน — เปิด session เร็วขึ้น ไม่ต้องติดตั้งใหม่ทุกครั้ง

ถ้าอยาก snapshot ใน Dashboard (ทางเลือก):

1. Dashboard → **Cloud Agents** → **Environments**
2. สร้าง environment สำหรับ repo นี้ → รัน setup → **Save snapshot**
3. ใส่ `snapshot` ใน `environment.json` ตาม [เอกสาร Cursor](https://cursor.com/docs/cloud-agent/setup)

สำหรับ **login Firebase จริง** ใน cloud: ใส่ใน **[cursor.com/dashboard](https://cursor.com/dashboard) → Cloud Agents → Secrets** (อย่า commit `.env.local` หรือรหัสผ่านลง git)

โปรเจกต์นี้ **ไม่มีไฟล์ `.login`** — ใช้ Secrets แทน

### Secrets สำหรับแอปกุ้ง (`apps/seafood-pos`)

| Secret (ชื่อใน Dashboard) | ใช้ทำอะไร |
|---------------------------|-----------|
| `VITE_FIREBASE_API_KEY` | config Firebase (build + runtime) |
| `VITE_FIREBASE_AUTH_DOMAIN` | เช่น `chincha-eeed6.firebaseapp.com` |
| `VITE_FIREBASE_DATABASE_URL` | Realtime DB (ถ้ามี) |
| `VITE_FIREBASE_PROJECT_ID` | `chincha-eeed6` |
| `VITE_FIREBASE_STORAGE_BUCKET` | bucket โปรเจกต์ |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | จาก Firebase Console |
| `VITE_FIREBASE_APP_ID` | **ของกุ้ง** (คนละตัวกับชา — ดู GitHub `VITE_FIREBASE_APP_ID_SHRIMP`) |

ค่าตัวอย่างชื่อตัวแปรอยู่ที่ `apps/seafood-pos/.env.example` (ไม่มีค่าจริง)

### ล็อกอินแอดมินให้ agent อ่าน Firestore (ทางเลือก)

ถ้าต้องการให้ Cloud Agent **ล็อกอินเป็นแอดมิน** (เช่น ดูรายชื่อ `shrimp_users`) เพิ่มใน Secrets **บน Dashboard เท่านั้น**:

| Secret | ตัวอย่าง |
|--------|----------|
| `SHRIMP_AGENT_EMAIL` | `peachtukta1014@gmail.com` |
| `SHRIMP_AGENT_PASSWORD` | รหัสผ่าน Firebase Auth ของบัญชีนั้น |

- อีเมล `peachtukta1014@gmail.com` เป็น **bootstrap admin** ในแอปกุ้ง (อนุมัติทันทีเมื่อสมัคร/ล็อกอินครั้งแรก)
- หลังเพิ่ม Secrets แล้ว **เริ่ม agent session ใหม่** (secret ไม่ติด session เก่า)
- อย่าใส่รหัสผ่านใน Slack / ใน PR / ใน repo

### Secret สำหรับจัดการ GitHub repo (ทางเลือก)

| Secret (Dashboard หรือ GitHub repo Secrets) | ใช้ทำอะไร |
|-------------------------------------------|-----------|
| `ADMIN_TOKEN` | PAT แก้ homepage / ลบ deployment environments (workflow `disconnect-vercel-github.yml`) |

สร้าง PAT: GitHub → Settings → Developer settings → Fine-grained token → repo `chinchaflow` → **Administration: Read and write** (หรือ classic token scope `repo` เต็ม)

ใส่ได้ทั้ง **GitHub repo Secrets** (ให้ Actions ใช้) และ **Cursor Dashboard Secrets** (ให้ Cloud Agent ใช้ `gh` หลังเปิด session ใหม่)

บนเครื่องตัวเอง: คัดลอก `.env.example` → `apps/seafood-pos/.env.local` แล้วเติมค่าจาก Firebase Console → Project settings → Your apps (Web app กุ้ง)

---

## 4) ทดสอบว่าพร้อมใช้

### ใน Slack

```text
@cursor สรุปสถานะ apps/seafood-pos บน main
```

หรือ:

```text
@cursor with sonnet, รัน smoke test กุ้ง
```

ถ้าได้คำตอบ + (ถ้าสั่งงานโค้ด) เห็น branch/PR — ขั้น 1–3 ใช้ได้

### บนเครื่อง / ใน agent (ไม่ต้อง login)

```bash
npm install
node apps/seafood-pos/scripts/smoke-test.mjs
npm run build --workspace=seafood-pos
```

### แอปจริง (มือถือ)

- กุ้ง: https://ko-seafood.top  
- ชา: https://chincha-tea.web.app  

ถ้า PWA ค้าง: รีเฟรชจากปุ่มใน header หรือลบแล้ว add หน้าจอหลักใหม่

---

## แผนที่งานใน repo (เวลาสั่ง agent)

| คำว่า | โฟลเดอร์ |
|-------|----------|
| กุ้ง / shrimp / seafood | `apps/seafood-pos` |
| ชา / tea | `apps/chincha-tea` |
| LINE webhook | `apps/webhook-core` |

รายละเอียด dev: `AGENTS.md`

---

## งงเรื่องโมเดล? (จำแค่นี้)

1. **Slack** → Sonnet จาก Dashboard (ข้อ 1)  
2. **IDE Agent** → เลือกเองใน dropdown (Sonnet หรือ Composer ก็ได้)  
3. **Composer ใน Slack** → ต้องพิมพ์ `with composer`  
4. **Error ภูมิภาค / provider** → ไม่ใช่การตั้งค่าผิด — ลอง Composer หรือรอแล้วลองใหม่  

ถ้ายังติด: ส่ง screenshot หน้า **Cloud Agents → My Settings** + ข้อความ error ใน thread เดิม
