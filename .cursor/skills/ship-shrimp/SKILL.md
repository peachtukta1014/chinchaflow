---
name: ship-shrimp
description: ปิดงานและ ship seafood-pos (ร้านกุ้ง) — ตรวจ, commit, push, เปิด PR draft ไปที่ main
---

# Ship: ร้านกุ้ง (seafood-pos)

ปิดงาน seafood-pos ด้วยขั้นตอนนี้ตามลำดับ:

## 1. Smoke test (บังคับ)

```bash
node apps/seafood-pos/scripts/smoke-test.mjs
```

ถ้าไม่ผ่าน → **หยุดทันที** รายงานปัญหา ไม่ push ต่อ

## 2. Build check (บังคับ)

```bash
npm run build --workspace=seafood-pos
```

ถ้าไม่ผ่าน → หยุด รายงาน error

## 3. Commit

- `git add` เฉพาะไฟล์ใน `apps/seafood-pos/` ที่เกี่ยวกับงาน (ไม่ใช้ `-A`)
- message: `feat/fix: <อธิบายสั้น ภาษาไทยหรืออังกฤษ>`

## 4. Push

```bash
git push -u origin <branch>
```

## 5. เปิด PR draft → main

PR body ต้องมี:
- สรุปงานที่แก้ (bullet)
- ✅ smoke test ผ่าน + ✅ build ผ่าน
- Production: https://ko-seafood.top
- หมายเหตุ: merge แล้ว CI/CD (`deploy-hosting.yml`) รัน deploy อัตโนมัติ

## 6. ไม่ merge เอง — รอ Peach กด merge
