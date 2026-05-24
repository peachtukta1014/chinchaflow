# chincha-business-os

Monorepo สำหรับระบบธุรกิจ Chincha (ร้านกุ้ง + ร้านชา) บน Firebase **`chincha-eeed6`**

| แอป | ลิงก์ | คำอธิบายสั้นๆ |
|-----|------|----------------|
| **กุ้ง** | https://chincha-shrimp.web.app | POS ขายกุ้ง, สต๊อก, ออเดอร์ LINE |
| **ชา** | https://chincha-tea.web.app | บันทึกขาย, สั่งของ, สรุปวัน (TH/MY/EN) |

---

## โครงสร้างโปรเจกต์ (Project Tree)

```
chincha-business-os/
├── apps/
│   ├── seafood-pos/          # POS กุ้ง → chincha-shrimp.web.app
│   ├── chincha-tea/          # POS ชา   → chincha-tea.web.app
│   └── webhook-core/         # LINE Webhook (Cloud Functions)
├── scripts/                  # รีเซ็ตข้อมูล / สต๊อก
├── docs/                     # เอกสาร (ดู PROJECT_STRUCTURE.md ฉบับเต็ม)
├── .github/workflows/        # Deploy แยก hosting / functions / rules
├── firebase.json
├── firestore.rules
└── package.json              # npm workspaces
```

**รายละเอียดทุกโฟลเดอร์ แท็บ UI, Firestore collections, ไฟล์สำคัญ:**  
→ [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md)

### แอปชา (`apps/chincha-tea`) — โครงใน `src/`

```
src/
├── main.jsx              # entry (สั้น)
├── App.jsx               # login + แท็บ + ตะกร้า
├── screens/              # หน้าหลัก: ขาย, ประวัติ, สรุป, สั่งของ, แอดมิน
├── components/           # header, ตะกร้า, การ์ดเมนู
└── lib/                  # orders, restock, สลิป, i18n, LINE
```

### แอปกุ้ง (`apps/seafood-pos`) — โครงใน `src/`

```
src/
├── main.jsx              # entry (สั้น)
├── App.jsx               # login + แท็บล่าง
├── screens/              # ขาย, สต๊อก, ออเดอร์ LINE, ภาพรวม, …
├── services/             # บิล, สต๊อก, หนี้, LINE orders
├── components/
└── lib/
```

---

## พัฒนา local

```bash
npm install
npm run dev:tea       # แอปชา
npm run dev:seafood   # แอปกุ้ง
```

Build:

```bash
npm run build --workspace=chincha-tea
npm run build --workspace=seafood-pos
```

---

## Deploy

Push ขึ้น `main` → GitHub Actions deploy อัตโนมัติ (แยกตามไฟล์ที่แก้):

- **Deploy Firebase Hosting** — กุ้ง / ชา
- **Deploy Cloud Functions** — LINE webhook
- **Deploy Firebase Rules** — Firestore + Storage rules

รันมือ: GitHub → **Actions** → เลือก workflow → **Run workflow**

---

## เคลียร์ข้อมูลร้านชา (Firestore)

ถ้าบันทึกในแอปแล้วไม่ขึ้น มักเพราะข้อมูลเก่าค้างใน DB ชื่อ `chincha` หรือเมนู/ออเดอร์รูปแบบเก่า — ใช้สคริปต์นี้ (ลบเฉพาะร้านชา ไม่แตะกุ้ง):

```bash
firebase login
gcloud auth application-default login --project chincha-eeed6

npm install
npm run tea:db-reset:dry          # ดูก่อน
npm run tea:db-reset:all          # ลบ (default) + chincha DB + seed เมนู
```

**ไม่มีเครื่อง local:** GitHub → Actions → **Tea DB Reset** → Run workflow  
1) dry run เปิดไว้ก่อน 2) รอบถัดไป ปิด dry run + พิมพ์ `RESET` ใน confirm_phrase

เก็บ `users` และ `config` ไว้ — หลังเคลียร์ต้องมี `users/{uid}` ที่ `approved: true`

---

## รีเซ็ตสต๊อกกุ้ง (ก่อนเริ่มวันใหม่)

```bash
gcloud auth application-default login --project chincha-eeed6
npm install
npm run shrimp:stock-reset:dry
npm run shrimp:stock-reset              # ตั้งกุ้งเป็น/ตาย = 0
npm run shrimp:stock-reset:full         # + ลบล็อต FIFO และออเดอร์ LINE เก่า
```

**Cloud:** push ไฟล์ `.ops/TRIGGER_SHRIMP_FULL_RESET` หรือ Actions → **Shrimp Stock Reset**

LINE กุ้ง — Webhook URL ใน LINE Developers ต้องชี้ไปที่  
`https://asia-southeast1-chincha-eeed6.cloudfunctions.net/lineWebhook` (ไม่ใช่ lineWebhookTea)

---

## เอกสารเพิ่ม

- [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md) — โครงสร้างเต็ม + collections
- [docs/CLOUD_STATUS.md](docs/CLOUD_STATUS.md) — สถานะ hosting / functions
- [docs/ENABLE_CLOUD_SCHEDULER.md](docs/ENABLE_CLOUD_SCHEDULER.md) — เปิด Scheduler สรุปอัตโนมัติ
