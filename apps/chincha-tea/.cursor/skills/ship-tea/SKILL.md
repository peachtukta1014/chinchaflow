---
name: ship-tea
description: Close out tea agent work — verify build, merge PR to main, wait for production deploy. Use when Peach says ship/ชิป/โอเค/ชินชา/โอเค ชา, merge, deploy, or ขึ้น prod for chincha-tea (including voice-to-text phrasing).
---

# Ship tea (verify → merge `main` → deploy)

Default **ปิดงาน** สำหรับ `#chincha-tea-agent` เมื่อทำฟีเจอร์/แก้บั๊กเสร็จ หรือหลังรอบแก้ PR แล้วพร้อมขึ้นโปรดักชัน

**ไม่ข้าม verify · ไม่ merge ถ้า build ไม่ผ่าน**

## เมื่อไหร่ต้องรัน skill นี้

- งานชาเสร็จแล้ว (มี PR หรือเพิ่งเปิด PR)
- ผู้ใช้สั่งแก้หลัง review แล้วต้องการขึ้น prod
- คำสั่งประมาณ: ship, merge, deploy, ขึ้น main, ขึ้นโปรดักชัน, ดีพลอย
- **ไม่รัน** ถ้ารอบนั้นเป็นแค่ถาม/ออกแบบ ไม่มี diff โค้ด
- **หยุด** ถ้าผู้ใช้บอกชัดว่า «แค่ PR», «อย่า merge», «รอ review ก่อน»

## คำสั่งเสียง / ไมค์ (Peach) — เท่ากับ `/ship-tea`

Peach มักพูดผ่านไมค์ ไม่ต้องพิมพ์ `/ship-tea` — ถ้าข้อความ **ตั้งใจปิดงานชาขึ้น prod** และอยู่บริบท `#chincha-tea-agent` / งานชา ให้ **รัน skill นี้ทันที** (ครบ build → merge → deploy):

| พูด / STT มักได้ | ทำ |
|------------------|-----|
| **โอเค/ชินชา** · โอเค ชินชา · โอเคชินชา | ใช่ → ship ชา |
| โอเค/ชา · โอเค ชา · โอเคชา | ใช่ |
| ชิปชา · ship ชา · ship tea · ชิป tea | ใช่ |
| ขึ้น prod ชา · ดีพลอยชา · merge ชา | ใช่ (ถ้าไม่ได้บอก «อย่า merge») |

**ไม่ใช่คำสั่ง ship:** แค่ «โอเค» ไม่มีคำว่าชา/ชินชา/tea · คุยเรื่องอื่น · ถามอย่างเดียว

**สับสนกับกุ้ง:** ถ้ามีคำ **กุ้ง / แอปกุ้ง / shrimp / seafood** → ใช้ `/ship-shrimp` ไม่ใช่ skill นี้

## ลำดับขั้น (ทำครบทุกครั้ง)

### 1. เก็บงานบน branch

1. ตรวจ diff ตรงคำขอ ไม่มี `.env.local` / secret
2. `git commit` + `git push -u origin <branch>`
3. สร้างหรืออัปเดต PR ไป `main` (draft ได้ — ดู `/land-it` ถ้าต้องการ checklist เต็ม)

### 2. Verify — «smoke» ของชา

จาก root monorepo:

```bash
npm install
npm run build --workspace=chincha-tea
```

| ผล | ทำอย่างไร |
|----|-----------|
| **ผ่าน** | ไปขั้น 3 |
| **ไม่ผ่าน** | แก้บน branch → push → รัน build ใหม่ → **ห้าม merge** |

หมายเหตุ: ชาไม่มี `smoke-test.mjs` แบบกุ้ง — **production build คือเกณฑ์เดียว** (ตรง `auto-tea` / `AGENTS.md`)

### 3. Merge เข้า `main`

ใช้ **merge PR** (อย่า push ตรงเข้า `main` ถ้ามี PR อยู่แล้ว):

```bash
gh pr view --json number,url,state
gh pr merge <number> --squash --delete-branch
git fetch origin main
```

- ต้อง build ผ่านขั้น 2 แล้ว
- ถ้ายังไม่มี PR → เปิดก่อน (`/land-it`) แล้วค่อย merge

### 4. Deploy อัตโนมัติ

หลัง merge `main` ถ้าแตะ `apps/chincha-tea/**` (หรือ shared deps) workflow จะรันเอง:

- `.github/workflows/deploy-hosting.yml` → job **Deploy Chincha Tea**
- โปรดักชัน: https://chincha-tea.web.app

รอผล (เลือกอย่างใดอย่างหนึ่ง):

```bash
gh run list --branch main --workflow deploy-hosting.yml --limit 5
gh run watch <run-id> --exit-status
```

ถ้า deploy ล้ม → แจ้งลิงก์ Actions + เปิด branch แก้ใหม่ อย่า merge ซ้ำโดยไม่แก้

### 5. รายงานกลับ (Slack / แชท)

สรุปสั้น ๆ:

- PR ที่ merge + ลิงก์
- Verify: build ผ่าน
- Deploy: สำเร็จ / กำลังรัน / ล้มเหลว (+ ลิงก์ run)
- Live: https://chincha-tea.web.app

## ขอบเขต

| โฟลเดอร์ | หมายเหตุ |
|----------|----------|
| `apps/chincha-tea/` | หลัก |
| `apps/webhook-core/` | เฉพาะเมื่องาน PR นั้นแตะ webhook ชา |
| `apps/seafood-pos/` | **ไม่ใช้ skill นี้** — ใช้ `auto-shrip` + `deploy-shrimp` |

## สิ่งที่ skill นี้ **ไม่** ทำ (นโยบายทีม)

- **ไม่** เพิ่ม GitHub Actions CI รันบนทุก PR — ใช้ build มือ/skill ก่อน merge แล้ว deploy บน `main` ตาม workflow เดิม
- **ไม่** แทนที่ `/land-it` ตอนเปิด PR ครั้งแรก — `ship-tea` เน้นปิดงานหลัง verify + merge + deploy

## Skill ที่เกี่ยวข้อง

| Skill | หน้าที่ |
|-------|---------|
| `/land-it` | เปิด/อัปเดต PR, ตาราง verify ตามแอป |
| `/auto-tea` | เช็กสุขภาพอย่างเดียว (ไม่ merge) |
| `/deploy-tea` | อ้างอิง workflow deploy + manual dispatch |

## คำสั่งย่อ (Peach / agent)

> งานชาเสร็จแล้ว → `/ship-tea` หรือพูด **「โอเค/ชินชา」**  
> (= build ผ่าน → merge PR → รอ deploy ชา)
