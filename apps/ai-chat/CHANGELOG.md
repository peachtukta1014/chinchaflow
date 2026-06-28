# CHANGELOG — ai-chat

บันทึกการเปลี่ยนแปลงของ AI Admin Chat PWA  
รูปแบบ: `วันที่ | PR | รายละเอียด`

---

## 2026-06

### 2026-06-29 | feat: progress indicator แสดง PRO badge + step จาก tool call จริง
- `src/App.jsx` — เพิ่ม `PRO` badge (text-ai-accent) ข้างๆ dots เมื่อโปรทำงาน (progressStep set)
- `src/App.jsx` — แสดง step text จากการเรียก tool จริง (เช่น "กำลังอ่านไฟล์: xxx", "กำลัง patch: xxx") แทน fallback ทั่วไป
- `src/App.jsx` — fallback text เปลี่ยนเป็น "Flash กำลังรับคำสั่ง..." เมื่อยังไม่มี step

### 2026-06-29 | fix: Pro Agent รันเสร็จแต่ UI เงียบ — progress indicator + isMaxIter + TTL
- `src/App.jsx` — เปลี่ยน `{loading && ...}` → `{(loading || progressStep) && ...}` ให้ dots + step text โชว์ตลอดที่โปรยังทำงาน
- `src/App.jsx` — background recovery window 30 นาที → 2 ชั่วโมง
- `apps/webhook-core/src/aiWorkflowAgent.js` — isMaxIter เพิ่ม regex ตรวจ Thai error `'เกิน N รอบ'`
- `apps/webhook-core/src/shared/progressTracker.js` — writeResult TTL 30 นาที → 2 ชั่วโมง

### 2026-06-29 | fix: เลขเวอร์ชันแสดงวันที่ผิด — UTC vs ไทย UTC+7
- `.github/workflows/deploy-hosting.yml` Bump version step — เปลี่ยน `date -u` → `TZ=Asia/Bangkok date` (BE_YY, DDMMYY, TODAY)

### 2026-06-28 | fix: Knowledge tab แสดง error จริงแทนที่ "ยังไม่มีข้อมูล" ตลอด
- `src/firebase.js` — เอา try-catch ออกจาก `getProjectTree()` + `getAgentDocs()` ให้ error propagate ขึ้นมา
- `src/App.jsx` — `loadKnowledge` capture error ใส่ `treeError` + `docsError` state
- `src/components/KnowledgePanel.jsx` — แสดง error code จริงถ้าโหลดไม่ได้ (เช่น `permission-denied`)

### 2026-06-28 | refactor: แยก App.jsx → 4 ไฟล์ (icons, LoginScreen, KnowledgePanel, TokenDashboard)
- `src/icons.jsx` — แยก SVG icon components ทั้ง 11 ตัวออก (export named)
- `src/LoginScreen.jsx` — แยก LoginScreen component + import `signInWithGoogle` ตรง
- `src/components/KnowledgePanel.jsx` — แยก KnowledgePanel component
- `src/components/TokenDashboard.jsx` — แยก TokenDashboard component
- `src/App.jsx` — เหลือแค่ App (auth gate) + AppShell (~420 บรรทัด จาก 1,076)

### 2026-06-28 | PR (this)
**feat: เพิ่ม Google Sign-in login (whitelist peachtukta1014@gmail.com)**
- `src/firebase.js` — เพิ่ม `signInWithGoogle`, `signOutUser`, `onAuthChanged`; เพิ่ม `authDomain` ใน config
- `src/App.jsx` — auth gate (App → LoginScreen / AppShell); ปุ่ม logout ใน header
- `.github/workflows/deploy-hosting.yml` — เพิ่ม `VITE_FIREBASE_AUTH_DOMAIN` env var

### 2026-06-28 | PR #392
**fix: progress polling ระหว่างรอ Pro Agent + timeout 10 นาที**
- `src/App.jsx` — ต่อ `pollProgress` (3s) หลัง "processing" เพื่อแสดง ACK + steps จาก Pro
- เปลี่ยน timeout เป็น time-based 10 นาที แทน count-based 5 นาที (แก้ mobile background throttle)
- `unsubscribeRef` cleanup ล้าง `pollIntervalRef` ด้วยเสมอ

### 2026-06-28 | PR #391
**fix: เปลี่ยน result delivery จาก Firestore onSnapshot เป็น HTTP polling**
- `src/App.jsx` — ลบ `listenForResult` (Firestore onSnapshot ถูก Security Rules block)
- ใช้ `setInterval` + `fetchResult` HTTP ทุก 5s แทน (ผ่าน Firebase Admin SDK, bypass Security Rules)
- `unsubscribeRef` เปลี่ยนเป็นเก็บ `() => clearInterval(timerId)` แทน onSnapshot fn

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
