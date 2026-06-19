# CHANGELOG — ai-chat

บันทึกการเปลี่ยนแปลงของ AI Admin Chat PWA  
รูปแบบ: `วันที่ | PR | รายละเอียด`

---

## 2026-06

### 2026-06-19 | PR #287
**feat: เพิ่มปุ่มแนบรูปภาพ + อัปเดต persona เป็นเลขาส่วนตัวพีช**
- `App.jsx`
  - เพิ่ม `IconImage` SVG icon + `fileInputRef` + `imagePreview` state
  - ปุ่ม 📸 เปิด file picker (image/*) — มี thumbnail preview พร้อมปุ่ม × ลบก่อนส่ง
  - Bubble แชทแสดงรูปที่ผู้ใช้ส่ง (inline image)
  - อัปเดต persona จาก "เด๊ฟ" → "เลขา" (🗂) พร้อม welcome message ใหม่
  - `handleSend` รองรับส่งได้เมื่อมีรูปแต่ไม่มีข้อความ
- `api.js`
  - `chatWithAI` รับ param `imageBase64` ส่งไป backend

---

> รายละเอียด system-wide ดูได้ที่ [docs/AGENT_CHANGELOG_TH.md](../../docs/AGENT_CHANGELOG_TH.md)
