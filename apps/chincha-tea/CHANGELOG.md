# CHANGELOG — chincha-tea

บันทึกการเปลี่ยนแปลงของแอปร้านน้ำชินชา ไม้ขาว (Tea POS)  
รูปแบบ: `วันที่ | PR | รายละเอียด`

---

## 2026-06

### 2026-06-22 | dev/atomic-inventory
**fix: import fsAtomicUpdate ที่ขาด + ทำ deductTeaOrderInventory เป็น atomic**
- `src/lib/inventoryService.js` — เพิ่ม `fsAtomicUpdate` เข้า import (เรียกใช้ใน `receiveRestockInventory` แต่ไม่เคย import → ReferenceError ทุกครั้งที่รับของ)
- `src/lib/inventoryService.js` — `deductTeaOrderInventory`: เปลี่ยนจาก read-then-write (`fsPatch`) เป็น atomic update (`fsAtomicUpdate` + `increments: { stock_base_qty: -qty }`) กันสต๊อกตัดผิดตอนขายพร้อมกัน; UI ที่แสดงสต๊อกใช้ `Math.max(0,...)` / `nonNegativeInt` อยู่แล้วรับมือกรณีติดลบชั่วคราวได้

### 2026-06-19 | PR #285
**fix: กรองรายการออเดอร์สั่งของที่ถูกยกเลิกออกจากหน้า RestockTab**
- `RestockTab.jsx` — เพิ่ม `&& normalizeRestockStatus(r.purchaseStatus) !== 'cancelled'` ใน filter รายการสั่งของ pending ทั้งสองจุด (guard + render)
- ออเดอร์ที่กด "ยกเลิก" จะหายออกจากรายการทันที ไม่โชว์อีก

---

> รายละเอียด system-wide และ webhook ดูได้ที่ [docs/AGENT_CHANGELOG_TH.md](../../docs/AGENT_CHANGELOG_TH.md)
