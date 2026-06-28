---
description: "ตรวจ + commit + push + เปิด PR สำหรับ seafood-pos (ร้านกุ้ง)"
---

Ship งาน **ร้านกุ้ง (seafood-pos)** ด้วยขั้นตอนนี้:

1. **Smoke test**:
   ```bash
   node apps/seafood-pos/scripts/smoke-test.mjs
   ```
   ถ้าไม่ผ่าน → หยุด รายงานปัญหา ไม่ push ต่อ

2. **Build check**:
   ```bash
   npm run build --workspace=seafood-pos
   ```
   ถ้าไม่ผ่าน → หยุด รายงาน error

3. **Commit** (ถ้ายังไม่ได้ commit):
   - `git add` เฉพาะไฟล์ใน `apps/seafood-pos/` ที่เกี่ยวกับงาน
   - commit message: `feat/fix: <อธิบายสั้น>`

4. **Push** → `git push -u origin <branch>`

5. **เปิด PR ปกติ (ไม่ใช่ draft)** ไปที่ `main`:
   - ชื่อ PR: ชัดเจน บอกว่าแก้อะไร
   - Body: สรุปงาน + smoke test ผ่าน + build ผ่าน
   - Production: https://ko-seafood.top
   - หลัง merge CI/CD รัน `deploy-hosting.yml` อัตโนมัติ

6. **ไม่ merge เอง** — รอ Peach กด merge
