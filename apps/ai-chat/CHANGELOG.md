# CHANGELOG — ai-chat

บันทึกการเปลี่ยนแปลงของ AI Admin Chat PWA  
รูปแบบ: `วันที่ | PR | รายละเอียด`

---

## 2026-06


## 2026-06-24 | Peach

refactor: ถอดระบบแยกกลุ่ม (Scope Picker) ออกจากหน้าบ้าน สู่ Decoupled Architecture + ปรับปรุงอวตาร์ผู้ใช้

- src/App.jsx
  - [ลบออก] ปุ่ม UI เลือกกลุ่ม Agent (Scope Dropdown Picker) บน Header ขวา
  - [ลบออก] สเตทควบคุมกลุ่ม `agentScope`, `showAgentPicker` และอาเรย์ตัวเลือกกลุ่ม `AGENT_OPTIONS`
  - [ลบออก] ฟังก์ชันการทำงานฝั่งตรวจจับคำดักกลุ่มอัตโนมัติ `detectScope(text)`
  - [ปรับปรุง] ระบบจัดเก็บสเตตัส Session แชท โดยถอดการผูกตัวแปรสโคป และลบป้าย Tag กลุ่มในแถบประวัติแชทออกทั้งหมด
  - [แก้ไข] ปรับเปลี่ยน CSS รูปอวตาร์ผู้ใช้ (`peach-avatar.jpg`) จาก `object-top` → `object-[center_28%]` เพื่อขยับมุมกล้องมาโฟกัสเจาะจงใบหน้าพี่พีชให้กึ่งกลางวงกลมแชทพอดี ไม่หลุดเฟรมไปหลังคาปราสาทหรือพุงเสื้อดำ
- src/api.js
  - [ปรับปรุง] ถอดพารามิเตอร์ `scope` ออกจากออบเจกต์คำขอในฟังก์ชัน `chatWithAI` และออบเจกต์ซิงค์ข้อมูล `fetchResult`
  - [Decoupled] ผลักภาระหน้าที่การวิเคราะห์เจตนา (Intent Classification) และการจัดสรรขอบเขตแอปพลิเคชัน (ร้านชา/ร้านกุ้ง/งานระบบ) ไปให้ตัว Cloud Function ฝั่ง Backend จัดการแต่เพียงผู้เดียว 100% ช่วยให้โค้ดหน้าบ้านคลีนและเบาขึ้น
- PWA & Build Config Verification
  - ตรวจสอบและยืนยันความพร้อมของไฟล์ `manifest.json`, `index.html`, `tailwind.config.js` และ `vite.config.js` ให้ทำงานสอดประสานรองรับสถาปัตยกรรมแอปพลิเคชันรูปแบบใหม่แบบไร้รอยต่อ



### 2026-06-21 | PR #317
**feat: ปุ่ม Refresh + เลขเวอร์ชัน ai-DDMMYY.N (auto-bump ทุก deploy)**
- `src/App.jsx` — เพิ่ม `IconRefresh` SVG + ปุ่ม 🔄 ขวาสุด header (`window.location.reload()`)
- `src/App.jsx` — แสดง `APP_VERSION` ใต้ "CHINCHA FLOW" ใน header ซ้าย
- `src/version.js` — ไฟล์ใหม่ เก็บ `APP_VERSION` (fallback = `ai-dev`, ค่าจริง inject ตอน deploy)
- `.github/workflows/deploy-hosting.yml` — เพิ่ม step "Bump version" ก่อน build:
  คำนวณ DDMMYY (ปีพศ 2 หลัก) + นับ deploy runs วันนี้ผ่าน gh api → เขียน version.js อัตโนมัติ
  วันใหม่รีเซตเป็น .1

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
