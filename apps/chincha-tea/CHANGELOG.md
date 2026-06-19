# CHANGELOG — chincha-tea

บันทึกการเปลี่ยนแปลงของแอปร้านน้ำชินชา ไม้ขาว (Tea POS)  
รูปแบบ: `วันที่ | PR | รายละเอียด`

---

## 2026-06

### 2026-06-19 | PR #285
**fix: กรองรายการออเดอร์สั่งของที่ถูกยกเลิกออกจากหน้า RestockTab**
- `RestockTab.jsx` — เพิ่ม `&& normalizeRestockStatus(r.purchaseStatus) !== 'cancelled'` ใน filter รายการสั่งของ pending ทั้งสองจุด (guard + render)
- ออเดอร์ที่กด "ยกเลิก" จะหายออกจากรายการทันที ไม่โชว์อีก

---

> รายละเอียด system-wide และ webhook ดูได้ที่ [docs/AGENT_CHANGELOG_TH.md](../../docs/AGENT_CHANGELOG_TH.md)
