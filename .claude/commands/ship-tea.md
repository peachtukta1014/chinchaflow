---
description: "ตรวจ + commit + push + เปิด PR สำหรับ chincha-tea (ร้านชา)"
---

Ship งาน **ร้านชา (chincha-tea)** ด้วยขั้นตอนนี้:

1. **Build check**:
   ```bash
   npm run build --workspace=chincha-tea
   ```
   ถ้าไม่ผ่าน → หยุด รายงาน error ไม่ push ต่อ

2. **Commit** (ถ้ายังไม่ได้ commit):
   - `git add` เฉพาะไฟล์ใน `apps/chincha-tea/` ที่เกี่ยวกับงาน
   - commit message: `feat/fix: <อธิบายสั้น>`

3. **Push** → `git push -u origin <branch>`

4. **เปิด PR ปกติ (ไม่ใช่ draft)** ไปที่ `main`:
   - ชื่อ PR: ชัดเจน บอกว่าแก้อะไร
   - Body: สรุปงาน + build ผ่าน
   - Production: https://chincha-tea.web.app
   - หลัง merge CI/CD รัน `deploy-hosting.yml` อัตโนมัติ

5. **ไม่ merge เอง** — รอ Peach กด merge
