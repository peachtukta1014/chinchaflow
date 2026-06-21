---
name: ship-tea
description: ปิดงานและ ship chincha-tea (ร้านชา) — ตรวจ, commit, push, เปิด PR draft ไปที่ main
---

# Ship: ร้านชา (chincha-tea)

ปิดงาน chincha-tea ด้วยขั้นตอนนี้ตามลำดับ:

## 1. Build check (บังคับ)

```bash
npm run build --workspace=chincha-tea
```

ถ้าไม่ผ่าน → **หยุดทันที** รายงาน error ไม่ push ต่อ

## 2. Commit

- `git add` เฉพาะไฟล์ใน `apps/chincha-tea/` ที่เกี่ยวกับงาน (ไม่ใช้ `-A`)
- message: `feat/fix: <อธิบายสั้น ภาษาไทยหรืออังกฤษ>`

## 3. Push

```bash
git push -u origin <branch>
```

## 4. เปิด PR draft → main

PR body ต้องมี:
- สรุปงานที่แก้ (bullet)
- ✅ build ผ่าน
- Production: https://chincha-tea.web.app
- หมายเหตุ: merge แล้ว CI/CD (`deploy-hosting.yml`) รัน deploy อัตโนมัติ

## 5. ไม่ merge เอง — รอ Peach กด merge
