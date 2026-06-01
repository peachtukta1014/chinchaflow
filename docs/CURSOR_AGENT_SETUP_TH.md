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

Repo นี้ = monorepo **ชา + กุ้ง** ชื่อ GitHub ประมาณ `chincha-tea-Privately-` — งานกุ้งอยู่ที่ `apps/seafood-pos`

---

## 1) Dashboard — Cloud Agents → My Settings

เปิด: [cursor.com/dashboard](https://cursor.com/dashboard) → **Cloud Agents** → **My Settings**

| ช่อง | ค่าที่แนะนำ |
|------|-------------|
| **Default Model** | **Claude 4.6 Sonnet** |
| **Default repository** | repo monorepo ของทีม (chincha) |
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

ช่อง `#chincha-flow` ใช้คุยทั่วไป / ประสานงานได้ตามเดิม

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

Cursor โหลด skills จากโฟลเดอร์ `.cursor/skills/` อัตโนมัติ — ใน monorepo วางแบบนี้:

```text
chincha/
├── .cursor/skills/              # ทั้ง repo (เช่น land-it)
│   └── land-it/SKILL.md
├── apps/seafood-pos/.cursor/skills/   # เฉพาะกุ้ง
│   └── deploy-shrimp/SKILL.md
└── apps/chincha-tea/.cursor/skills/   # เฉพาะชา
    └── deploy-tea/SKILL.md
```

- Skills ใต้ `apps/seafood-pos/` จะโผล่เมื่อ agent ทำงานกับไฟล์ในแอปกุ้งเท่านั้น (คล้าย scope ของช่อง `#chincha-shrimp-agent`)
- เรียกเองในแชท: พิมพ์ `/` แล้วเลือกชื่อ skill (เช่น `/deploy-shrimp`, `/land-it`)
- เอกสาร: [cursor.com/docs/skills](https://cursor.com/docs/skills)

### Environment


ไฟล์ `.cursor/environment.json` บอก agent ให้รัน `npm install` ก่อนงาน — เปิด session เร็วขึ้น ไม่ต้องติดตั้งใหม่ทุกครั้ง

ถ้าอยาก snapshot ใน Dashboard (ทางเลือก):

1. Dashboard → **Cloud Agents** → **Environments**
2. สร้าง environment สำหรับ repo นี้ → รัน setup → **Save snapshot**
3. ใส่ `snapshot` ใน `environment.json` ตาม [เอกสาร Cursor](https://cursor.com/docs/cloud-agent/setup)

สำหรับ **login Firebase จริง** ใน cloud: ใส่ `VITE_FIREBASE_*` ใน **Dashboard → Secrets** (อย่า commit `.env.local`)

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
