---
description: "ปิดงาน — ตรวจ, commit, push, เปิด PR draft ไปที่ main"
---

ปิดงานด้วยขั้นตอนนี้ตามลำดับ:

1. **Diff review** — เช็ก `git diff` และ `git status` ว่า changes ตรงกับงานที่สั่ง ไม่มีไฟล์แปลกหรือ secret หลุด

2. **Verify** ตามแอปที่แตะ:
   - `apps/seafood-pos/**` → `node apps/seafood-pos/scripts/smoke-test.mjs` แล้ว `npm run build --workspace=seafood-pos`
   - `apps/chincha-tea/**` → `npm run build --workspace=chincha-tea`
   - `apps/webhook-core/**` → ไม่มี local server · ตรวจ syntax เท่านั้น
   - ถ้าแตะหลายแอป → รันทุกอัน

3. **Commit** — ถ้ายังไม่ได้ commit: `git add` เฉพาะไฟล์ที่เกี่ยว แล้ว commit พร้อม message สั้นชัด

4. **Push** — `git push -u origin <branch>`

5. **PR** — เปิด PR ปกติ (ไม่ใช่ draft) ไปที่ `main` พร้อม:
   - สรุปงานที่แก้ (bullet)
   - แอปที่กระทบ + production URL
   - คำสั่ง verify ที่รันแล้ว
   - ผลการ verify (ผ่าน/ไม่ผ่าน)

6. **อย่า merge เอง** — รอ Peach กด merge เสมอ
