# โครงสร้างโปรเจกต์ (Project Tree)

**CHINCHA FLOW** (ระบบรวม) · monorepo **chincha-business-os** · Firebase `chincha-eeed6` — [CHINCHA_FLOW_NAMING_TH.md](./CHINCHA_FLOW_NAMING_TH.md)

| แอป | URL Hosting | ผู้ใช้หลัก |
|-----|-------------|-----------|
| กุ้ง `seafood-pos` | https://ko-seafood.top | พนักงานร้านกุ้ง |
| ชา `chincha-tea` | https://chincha-tea.web.app | พนักงานร้านชา + แอดมิน |
| LINE `webhook-core` | Cloud Functions | บอท LINE กุ้ง/ชา |

---

## ต้นไม้โปรเจกต์ (ภาพรวม)

```
chincha-business-os/
├── apps/                          # แอปหลัก (npm workspaces)
│   ├── seafood-pos/               # POS กุ้ง
│   ├── chincha-tea/               # POS ร้านชา/กาแฟ/ปั่น
│   ├── webhook-core/              # LINE webhook + สรุปปิดวัน (Functions)
│   └── webhook-core-scheduled/    # สรุปชาอัตโนมัติ (ถ้า deploy แยก codebase)
│
├── scripts/                       # สคริปต์ดูแลข้อมูล (รันจาก root)
│   ├── tea-db-reset.mjs           # เคลียร์ข้อมูลร้านชา
│   └── shrimp-stock-reset.mjs     # รีเซ็ตสต๊อก/ข้อมูลกุ้ง
│
├── docs/                          # คู่มือ / โครงสร้าง (อ้างอิงใน repo)
│   ├── PROJECT_STRUCTURE.md       # ไฟล์นี้
│   ├── CLOUD_STATUS.md
│   └── ENABLE_CLOUD_SCHEDULER.md
│
├── .github/workflows/             # CI/CD (deploy แยกตาม path)
│   ├── deploy-hosting.yml         # build + deploy กุ้ง/ชา
│   ├── deploy-functions.yml       # deploy webhook-core
│   ├── deploy-rules.yml           # Firestore + Storage rules
│   ├── tea-db-reset.yml
│   └── shrimp-stock-reset.yml
│
├── firebase.json                  # Hosting, Functions, Firestore config
├── firestore.rules                # rules DB (default) — ชา + กุ้ง
├── firestore-chincha.rules        # rules DB ชื่อ chincha (ชา legacy)
├── storage.rules
├── package.json                   # workspaces + scripts รวม
└── README.md
```

---

## แอปชา `apps/chincha-tea/`

**สแต็ก:** React 19 + Vite · Firestore REST + Firebase Auth/Storage · 3 ภาษา (TH / MY / EN)

```
apps/chincha-tea/
├── public/
│   ├── chincha-logo.jpg
│   └── manifest.json              # PWA
├── src/
│   ├── main.jsx                   # entry เท่านั้น → render <App />
│   ├── App.jsx                    # login, แท็บ, ตะกร้า, routing หน้าหลัก
│   ├── firebase.js                # init Firebase client
│   │
│   ├── screens/                   # หนึ่งไฟล์ ≈ หนึ่งแท็บ/หน้าหลัก
│   │   ├── LoginScreen.jsx        # ล็อกอิน / สมัคร / รออนุมัติ
│   │   ├── OrderTab.jsx           # บันทึกขาย + เสียง + เมนู
│   │   ├── HistoryScreen.jsx      # ประวัติออเดอร์รายวัน
│   │   ├── SummaryTab.jsx         # สรุปยอดขาย / ค่าใช้จ่าย / ซื้อของ / LINE
│   │   ├── RestockTab.jsx         # สั่งของเข้าร้าน + สลิป + ซื้อแล้ว+ราคา
│   │   └── AdminPanel.jsx         # สมาชิก, เมนู, ท็อปปิ้ง, LINE config
│   │
│   ├── components/                # UI ย่อย (ไม่มี business logic หนัก)
│   │   ├── AppHeader.jsx          # โลโก้, เปลี่ยนภาษา, logout
│   │   ├── TabNav.jsx             # แถบแท็บ
│   │   ├── CartSheet.jsx          # ตะกร้า + สด/โอน + บันทึก
│   │   ├── MenuCard.jsx
│   │   └── CustomizeModal.jsx     # ปรับแต่งแก้ว (หวาน/ท็อปปิ้ง)
│   │
│   └── lib/                       # logic + Firebase helpers
│       ├── firestoreRest.js       # REST client Firestore
│       ├── authSession.js         # subscribe สมาชิกที่อนุมัติแล้ว
│       ├── orderService.js        # บันทึก teaOrders
│       ├── orderSlipService.js    # อัปโหลดสลิป → Storage + orderSlips
│       ├── restockService.js      # สั่งของ / ซื้อแล้ว / ลบรายการ
│       ├── useCatalog.js          # โหลด products + toppings
│       ├── voiceOrder.js          # พูดสั่งเมนู
│       ├── lineNotify.js          # ส่งสรุป LINE (จากแอป)
│       ├── i18n.js                # แปล TH / MY / EN
│       └── constants.js           # หมวดเมนู, dateKey กรุงเทพ
│
├── index.html
├── vite.config.js
└── package.json
```

### Firestore collections (ชา — DB default)

| Collection | ใช้ทำอะไร |
|------------|-----------|
| `users` | สมาชิกแอป (approved, role) |
| `teaOrders` | บิลขายรายวัน |
| `dailyExpenses` | ค่าใช้จ่ายร้าน |
| `restocks` | รายการสั่งของเข้าร้าน (`purchaseStatus`, `purchaseTotal`) |
| `orderSlips` | รูปใบสั่งของ/สลิป (Storage URL) |
| `products` / `toppings` | เมนู |
| `config/teaLine` | ตั้งค่า LINE สรุปปิดวัน |

### แท็บในแอป → ไฟล์

| แท็บ UI | ไฟล์ screen |
|---------|-------------|
| บันทึกขาย | `OrderTab.jsx` |
| ประวัติ | `HistoryScreen.jsx` |
| สรุป | `SummaryTab.jsx` |
| สั่งของ | `RestockTab.jsx` |
| สมาชิก/ตั้งค่า (แอดมิน) | `AdminPanel.jsx` |

---

## แอปกุ้ง `apps/seafood-pos/`

**สแต็ก:** React + Vite · Firestore SDK + REST · LINE ออเดอร์ → ขาย

```
apps/seafood-pos/
├── public/
│   └── logo.jpg
├── src/
│   ├── main.jsx                   # entry only
│   ├── App.jsx                    # auth, แท็บล่าง, stock realtime
│   ├── firebase.js
│   │
│   ├── screens/
│   │   ├── LoginScreen.jsx
│   │   ├── POSMobile.jsx          # ขายของ + รูปบิล + เสียง
│   │   ├── Dashboard.jsx          # ภาพรวมวัน / ลูกหนี้
│   │   ├── InventoryScreen.jsx    # รับสต๊อก + ย้ายกุ้งตาย
│   │   ├── MembersScreen.jsx      # ลูกค้า
│   │   ├── LineOrdersScreen.jsx   # ออเดอร์ LINE → ส่งเรียบร้อย
│   │   ├── LineDeliveryConfirmSheet.jsx
│   │   ├── ProductSettingsScreen.jsx
│   │   └── AdminUsersScreen.jsx
│   │
│   ├── components/
│   │   └── NavButton.jsx
│   │
│   ├── services/                  # business logic แยกจาก UI
│   │   ├── salesService.js        # saveBillWithCart, ตรวจสต๊อก
│   │   ├── stockService.js        # persist stock, stockBatches
│   │   ├── debtService.js         # ลูกหนี้
│   │   ├── customerService.js
│   │   └── lineOrderService.js    # LINE orders
│   │
│   ├── lib/
│   │   ├── firestoreRest.js
│   │   ├── lineOrderToSale.js
│   │   ├── voiceParse.js
│   │   └── date.js
│   │
│   ├── constants/                 # สินค้า, ลูกค้าเริ่มต้น, การชำระ
│   └── hooks/
│       └── useVoice.js
│
└── package.json
```

### Firestore collections (กุ้ง)

| Collection | ใช้ทำอะไร |
|------------|-----------|
| `shrimp_users` | พนักงานกุ้ง |
| `config/stock` | สต๊อกกุ้งเป็น/ตาย (realtime) |
| `stockBatches` | ล็อตรับเข้า (ราคา/กก., ค่ารถ) |
| `sales` | บิลขาย |
| `customerDebts` | ลูกหนี้ |
| `customers` | รายชื่อลูกค้า |
| `lineOrders` | ออเดอร์จาก LINE |
| `productSettings/shrimp` | ราคากุ้ง |

### แผนถัดไป (กุ้ง)

- อัปโหลด**สลิปยืนยันซื้อ**ตอนรับสต๊อก — pattern เดียวกับ `orderSlipService` ฝั่งชา

---

## LINE `apps/webhook-core/`

```
apps/webhook-core/
├── src/
│   ├── index.js                   # exports: lineWebhook, lineWebhookTea, teaPushSummary, …
│   ├── parseLineOrder.js          # แปลงข้อความ LINE → ออเดอร์กุ้ง
│   ├── shrimpLineIntent.js        # คำสั่ง help / สรุป กุ้ง
│   ├── shrimpDailySummary.js
│   ├── teaDailySummary.js         # ข้อความสรุปปิดวันชา
│   ├── webhookDedup.js            # กัน event ซ้ำ
│   └── notify.js
└── package.json
```

| Function | หน้าที่ |
|----------|---------|
| `lineWebhook` | รับข้อความ LINE กุ้ง |
| `lineWebhookTea` | health / ชา (ไม่รับออเดอร์ลูกค้าในกลุ่ม) |
| `teaPushSummary` | ส่งสรุปปิดวันชา (เรียกจากแอป/แอดมิน) |

---

## Deploy (GitHub Actions)

push `main` แล้วรันเฉพาะ workflow ที่ไฟล์เกี่ยวข้องเปลี่ยน:

| Workflow | เมื่อไฟล์เปลี่ยน | ผลลัพธ์ |
|----------|------------------|---------|
| `deploy-hosting.yml` | `apps/seafood-pos/**` หรือ `apps/chincha-tea/**` | Hosting กุ้ง/ชา |
| `deploy-functions.yml` | `apps/webhook-core/**` | Cloud Functions |
| `deploy-rules.yml` | `firestore*.rules`, `storage.rules` | Security rules |

รันมือ: GitHub → **Actions** → เลือก workflow → **Run workflow**

---

## คำสั่งที่ใช้บ่อย (จาก root)

```bash
npm install
npm run dev:tea              # พัฒนาแอปชา local
npm run dev:seafood          # พัฒนาแอปกุ้ง local
npm run build --workspace=chincha-tea
npm run build --workspace=seafood-pos
```

ดูรายละเอียดเคลียร์ DB / รีเซ็ตสต๊อกใน [README.md](../README.md)
