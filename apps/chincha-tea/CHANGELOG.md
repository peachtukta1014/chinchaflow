# CHANGELOG — chincha-tea

บันทึกการเปลี่ยนแปลงของแอปร้านน้ำชินชา ไม้ขาว (Tea POS)  
รูปแบบ: `วันที่ | PR | รายละเอียด`

---

## 2026-06

### 2026-06-24 | claude/new-session-358ebr
**fix: อัปโหลดรูปรายการประจำร้านไม่สำเร็จ — เพิ่ม storage rule `catalogImages/`**
- อาการ: ใส่รูปให้รายการประจำร้าน (RestockForm) แล้วขึ้น "อัปโหลดไม่สำเร็จ" แม้รูปเล็ก
- สาเหตุ: อัปโหลดไป `catalogImages/{id}.jpg` แต่ `storage.rules` (root) ไม่มี match path → โดน catch-all บล็อก
- แก้: เพิ่ม rule `catalogImages/{fileName}` (signed-in, < 3MB, image only) ใน `storage.rules`; โค้ดแอปไม่เปลี่ยน (มี `compressImageFile` 400×400 อยู่แล้ว)

### 2026-06-19 | PR #285
**fix: กรองรายการออเดอร์สั่งของที่ถูกยกเลิกออกจากหน้า RestockTab**
- `RestockTab.jsx` — เพิ่ม `&& normalizeRestockStatus(r.purchaseStatus) !== 'cancelled'` ใน filter รายการสั่งของ pending ทั้งสองจุด (guard + render)
- ออเดอร์ที่กด "ยกเลิก" จะหายออกจากรายการทันที ไม่โชว์อีก

---

> รายละเอียด system-wide และ webhook ดูได้ที่ [docs/AGENT_CHANGELOG_TH.md](../../docs/AGENT_CHANGELOG_TH.md)
