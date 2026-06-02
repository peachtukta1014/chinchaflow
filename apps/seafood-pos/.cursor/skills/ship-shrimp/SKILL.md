---
name: ship-shrimp
description: Close out shrimp agent work — smoke test, build, merge PR to main, wait for production deploy. Use after finishing a task, post-PR fixes, or when Peach says ship, merge, deploy, or ขึ้น prod for seafood-pos.
---

# Ship shrimp (smoke → build → merge `main` → deploy)

Default **ปิดงาน** สำหรับ `#chincha-shrimp-agent` เมื่อทำฟีเจอร์/แก้บั๊กเสร็จ หรือหลังรอบแก้ PR แล้วพร้อมขึ้นโปรดักชัน

**ไม่ข้าม smoke/build · ไม่ merge ถ้า verify ไม่ผ่าน**

## เมื่อไหร่ต้องรัน skill นี้

- งานกุ้งเสร็จแล้ว (มี PR หรือเพิ่งเปิด PR)
- ผู้ใช้สั่งแก้หลัง review แล้วต้องการขึ้น prod
- คำสั่งประมาณ: ship, merge, deploy, push main, ขึ้นโปรดักชัน, ดีพลอย
- **ไม่รัน** ถ้ารอบนั้นเป็นแค่ถาม/ออกแบบ ไม่มี diff โค้ด
- **หยุด** ถ้าผู้ใช้บอกชัดว่า «แค่ PR», «อย่า merge», «รอ review ก่อน»

## ลำดับขั้น (ทำครบทุกครั้ง)

### 1. เก็บงานบน branch

1. ตรวจ diff ตรงคำขอ ไม่มี `.env.local` / secret
2. `git commit` + `git push -u origin <branch>`
3. สร้างหรืออัปเดต PR ไป `main` (draft ได้ — ดู `/land-it` ถ้าต้องการ checklist เต็ม)

### 2. Verify — smoke + build กุ้ง

จาก root monorepo (รันทั้งคู่ ต้องผ่านทั้งคู่):

```bash
npm install
node apps/seafood-pos/scripts/smoke-test.mjs
npm run build --workspace=seafood-pos
```

| ผล | ทำอย่างไร |
|----|-----------|
| **ผ่าน** | ไปขั้น 3 |
| **ไม่ผ่าน** | แก้บน branch → push → รันใหม่ → **ห้าม merge** |

Smoke เป็น logic regression ไม่ต้อง login Firebase (ตรง `auto-shrip` / `deploy-shrimp`).

### 3. Merge เข้า `main`

ใช้ **merge PR** (อย่า push ตรงเข้า `main` ถ้ามี PR อยู่แล้ว):

```bash
gh pr view --json number,url,state
gh pr merge <number> --squash --delete-branch
git fetch origin main
```

- ต้อง smoke + build ผ่านขั้น 2 แล้ว
- ถ้ายังไม่มี PR → เปิดก่อน (`/land-it`) แล้วค่อย merge

### 4. Deploy อัตโนมัติ

หลัง merge `main` ถ้าแตะ `apps/seafood-pos/**` (หรือ shared deps) workflow จะรันเอง:

- `.github/workflows/deploy-hosting.yml` → job **Deploy Shrimp POS**
- โปรดักชัน: https://ko-seafood.top

รอผล:

```bash
gh run list --branch main --workflow deploy-hosting.yml --limit 5
gh run watch <run-id> --exit-status
```

ถ้า deploy ล้ม → แจ้งลิงก์ Actions + เปิด branch แก้ใหม่ อย่า merge ซ้ำโดยไม่แก้

### 5. รายงานกลับ (Slack / แชท)

สรุปสั้น ๆ:

- PR ที่ merge + ลิงก์
- Verify: smoke ผ่าน · build ผ่าน
- Deploy: สำเร็จ / กำลังรัน / ล้มเหลว (+ ลิงก์ run)
- Live: https://ko-seafood.top

## ขอบเขต

| โฟลเดอร์ | หมายเหตุ |
|----------|----------|
| `apps/seafood-pos/` | หลัก |
| `apps/webhook-core/` | เฉพาะเมื่องาน PR นั้นแตะ webhook กุ้ง |
| `apps/chincha-tea/` | **ไม่ใช้ skill นี้** — ใช้ `/ship-tea` |

## สิ่งที่ skill นี้ **ไม่** ทำ (นโยบายทีม)

- **ไม่** เพิ่ม GitHub Actions CI รันบนทุก PR — ใช้ smoke/build มือ/skill ก่อน merge แล้ว deploy บน `main` ตาม workflow เดิม
- **ไม่** แทนที่ `/land-it` ตอนเปิด PR ครั้งแรก — `ship-shrimp` เน้นปิดงานหลัง verify + merge + deploy

## Skill ที่เกี่ยวข้อง

| Skill | หน้าที่ |
|-------|---------|
| `/land-it` | เปิด/อัปเดต PR, ตาราง verify ตามแอป |
| `/auto-shrip` | เช็กสุขภาพอย่างเดียว (ไม่ merge) |
| `/deploy-shrimp` | อ้างอิง workflow deploy + manual dispatch |

## คำสั่งย่อ (Peach / agent)

> งานกุ้งเสร็จแล้ว → `/ship-shrimp`  
> (= smoke ผ่าน → build ผ่าน → merge PR → รอ deploy กุ้ง)
