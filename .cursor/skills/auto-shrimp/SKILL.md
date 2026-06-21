---
name: auto-shrimp
description: ตรวจสุขภาพ seafood-pos (ร้านกุ้ง) — smoke test + build check เท่านั้น ไม่แก้โค้ด ไม่เปิด PR
---

# Auto-check: ร้านกุ้ง (seafood-pos)

ตรวจสุขภาพ **อ่านอย่างเดียว** — ห้ามแก้โค้ดหรือเปิด PR ในขั้นตอนนี้

## ขั้นตอน

1. รัน smoke test (จาก repo root):
   ```bash
   node apps/seafood-pos/scripts/smoke-test.mjs
   ```

2. รัน build check:
   ```bash
   npm run build --workspace=seafood-pos
   ```

## รายงานผล

- ✅ ผ่าน — สรุปสั้นๆ ว่าโครงสร้างปกติดี
- ❌ ไม่ผ่าน — บอกชัดว่า error อะไร ไฟล์ไหน บรรทัดไหน พร้อมแนะนำวิธีแก้

## หลังตรวจเสร็จ

ถ้าพบปัญหาและ Peach ต้องการแก้ → ใช้ `/ship-shrimp` ปิดงานหลังแก้แล้ว
