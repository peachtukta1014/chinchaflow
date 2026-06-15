# CHINCHA FLOW

**ชื่อระบบรวม (แบรนด์):** CHINCHA FLOW · **ชื่อ repo (เทคนิค):** `chincha-business-os` · **GitHub repo:** `peachtukta1014/chinchaflow` · **คลาวด์:** Firebase `chincha-eeed6`

แพลตฟอร์มปฏิบัติการธุรกิจแบบ monorepo สำหรับร้านจริง 2 ฝั่ง: **โกอ้วนซีฟู้ด** + **ชินชา ไม้ขาว** + LINE backend หลังบ้าน อยู่ใน repo เดียวกัน

→ ชื่อและคำเรียกสากล: [docs/CHINCHA_FLOW_NAMING_TH.md](docs/CHINCHA_FLOW_NAMING_TH.md)

| แอปใน CHINCHA FLOW | โฟลเดอร์ | ลิงก์ | บทบาทหลัก |
|---|---|---|---|
| **โกอ้วน คลังซีฟู้ด** | `apps/seafood-pos` | https://ko-seafood.top | POS กุ้ง, สต๊อก, ลูกค้า, ลูกหนี้, LINE order, LIFF |
| **ชินชา Tea POS ไม้ขาว** | `apps/chincha-tea` | https://chincha-tea.web.app | POS ร้านน้ำ, สรุปวัน, หลังร้าน, เติมของ, ค่าใช้จ่าย, พนักงาน, 3 ภาษา |
| **LINE backend** | `apps/webhook-core` | Cloud Functions | webhook กุ้ง/ชา, สรุปยอด, แจ้งเตือน, กัน event ซ้ำ |
| **Scheduled backend** | `apps/webhook-core-scheduled` | Cloud Functions / Scheduler | งานสรุปอัตโนมัติ ถ้า deploy แยก codebase |

---

## โครงสร้างโปรเจกต์ (Project Tree ปัจจุบัน)

```text
chincha-business-os/
├── apps/                              # แอปหลักทั้งหมดใน monorepo (npm workspaces)
│   ├── seafood-pos/                   # โกอ้วนซีฟู้ด POS → ko-seafood.top
│   │   ├── public/                    # logo, manifest, static assets
│   │   ├── src/
│   │   │   ├── main.jsx               # entry ของเว็บ POS
│   │   │   ├── App.jsx                # auth, shell, tab navigation, stock realtime
│   │   │   ├── firebase.js            # Firebase client config
│   │   │   ├── screens/               # หน้าหลักของแอปกุ้ง
│   │   │   │   ├── POSMobile.jsx      # ขายกุ้ง, ตะกร้า, รูปบิล, เสียง
│   │   │   │   ├── SalesHubScreen.jsx # hub งานขาย / รายการขาย
│   │   │   │   ├── Dashboard.jsx      # ภาพรวมรายวัน / ลูกหนี้
│   │   │   │   ├── InventoryScreen.jsx# รับเข้า, ย้ายกุ้งตาย, สต๊อก
│   │   │   │   ├── LineOrdersScreen.jsx
│   │   │   │   ├── LineDeliveryConfirmSheet.jsx
│   │   │   │   ├── MembersScreen.jsx
│   │   │   │   ├── CustomerAccountsScreen.jsx
│   │   │   │   ├── ExpensesScreen.jsx
│   │   │   │   ├── LotCloseScreen.jsx
│   │   │   │   ├── ProductSettingsScreen.jsx
│   │   │   │   ├── AdminUsersScreen.jsx
│   │   │   │   ├── MyProfileScreen.jsx
│   │   │   │   └── LoginScreen.jsx
│   │   │   ├── components/            # UI panels/buttons/sheets ของกุ้ง
│   │   │   │   ├── AppHeaderMenu.jsx
│   │   │   │   ├── NavButton.jsx
│   │   │   │   ├── DateNavBar.jsx
│   │   │   │   ├── BillImageSheet.jsx
│   │   │   │   ├── SaleBillActions.jsx
│   │   │   │   ├── StockCountPanel.jsx
│   │   │   │   ├── StockLotTimeline.jsx
│   │   │   │   ├── LotPortfolioPanel.jsx
│   │   │   │   ├── LotReportPanel.jsx
│   │   │   │   ├── LotExpensesPanel.jsx
│   │   │   │   ├── LotExpensesSyncPanel.jsx
│   │   │   │   ├── LineOaCustomersPanel.jsx
│   │   │   │   ├── LineOrderRetentionPanel.jsx
│   │   │   │   ├── LineShareButton.jsx
│   │   │   │   ├── ShrimpLineNotifySettings.jsx
│   │   │   │   ├── PosCustomLinesPanel.jsx
│   │   │   │   ├── AdminAlertsBanner.jsx
│   │   │   │   ├── OfflineBanner.jsx
│   │   │   │   └── MemberAvatar.jsx
│   │   │   ├── services/              # business logic แยกจาก UI
│   │   │   ├── lib/                   # helper เช่น Firestore REST, date, LINE order mapping, voice parse
│   │   │   ├── constants/             # สินค้า, ลูกค้าเริ่มต้น, การชำระเงิน
│   │   │   ├── hooks/                 # custom hooks เช่น useVoice
│   │   │   └── liff/                  # LIFF app สำหรับ LINE order/slip/customer flow
│   │   ├── index.html
│   │   ├── package.json
│   │   └── vite.config.js
│   │
│   ├── chincha-tea/                   # ชินชา Tea POS → chincha-tea.web.app
│   │   ├── public/                    # โลโก้ + PWA manifest
│   │   ├── src/
│   │   │   ├── main.jsx               # entry ของเว็บร้านชา
│   │   │   ├── App.jsx                # auth, tabs, cart, app shell
│   │   │   ├── firebase.js            # Firebase client config
│   │   │   ├── screens/               # หน้าหลัก/แท็บของร้านชา (Smart POS)
│   │   │   │   ├── OrderTab.jsx       # ขายราคาแก้ว + ท็อปปิ้ง · ปิดวัน
│   │   │   │   ├── CupsTab.jsx        # สต๊อกแก้ว / เติมแก้ว
│   │   │   │   ├── RestockTab.jsx     # สั่งของ / ซื้อเข้าร้าน
│   │   │   │   ├── HistoryScreen.jsx  # ประวัติบิล + ปิดกะ
│   │   │   │   ├── ProfitTab.jsx      # แดชบอร์ดกำไร/สรุประบบ (เมนูแอดมิน)
│   │   │   │   ├── StockTab.jsx       # เช็คสต๊อกคงเหลือ (เมนูแอดมิน)
│   │   │   │   ├── AdminPanel.jsx     # สมาชิก · LINE · ประวัติออเดอร์
│   │   │   │   ├── MyProfileScreen.jsx
│   │   │   │   └── LoginScreen.jsx
│   │   │   ├── components/            # UI ย่อยของร้านชา
│   │   │   │   ├── AppHeader.jsx
│   │   │   │   ├── DailySummaryStickyBar.jsx
│   │   │   │   ├── TeaAppHeaderMenu.jsx   # เมนู ☰ แอดมิน
│   │   │   │   ├── TabNav.jsx
│   │   │   │   ├── CartSheet.jsx
│   │   │   │   ├── ToppingSaleSettings.jsx
│   │   │   │   ├── StockItemSettingsSheet.jsx
│   │   │   │   ├── VoiceCommandBar.jsx
│   │   │   │   ├── StaffGuidePanel.jsx
│   │   │   │   ├── StaffLangNudge.jsx
│   │   │   │   └── MemberAvatar.jsx
│   │   │   └── lib/                   # Firestore REST, auth, order, restock, slip, i18n, LINE, constants
│   │   ├── index.html
│   │   ├── package.json
│   │   └── vite.config.js
│   │
│   ├── webhook-core/                  # Cloud Functions หลักของ LINE
│   │   ├── src/
│   │   │   ├── index.js               # exports functions: lineWebhook, lineWebhookTea, teaPushSummary, ...
│   │   │   ├── parseLineOrder.js      # แปลงข้อความ LINE → ออเดอร์กุ้ง
│   │   │   ├── shrimpLineIntent.js    # คำสั่ง LINE ฝั่งกุ้ง
│   │   │   ├── shrimpDailySummary.js  # สรุปกุ้ง
│   │   │   ├── shrimpBillTemplateRows.js
│   │   │   ├── shrimpBuiltinCustomers.js
│   │   │   ├── shrimpLinePush.js
│   │   │   ├── teaDailySummary.js     # สรุปปิดวันร้านชา
│   │   │   ├── webhookDedup.js        # กัน event ซ้ำ
│   │   │   └── notify.js
│   │   └── package.json
│   │
│   └── webhook-core-scheduled/        # งาน scheduled ถ้าแยก deploy/codebase
│
├── packages/                          # shared packages ใช้ร่วมกันข้ามแอป
│   └── app-credits/                   # เครดิต/branding component package
│
├── scripts/                           # สคริปต์ดูแลข้อมูลจาก root
│   ├── tea-db-reset.mjs               # เคลียร์/seed ข้อมูลร้านชา
│   ├── shrimp-stock-reset.mjs         # รีเซ็ตสต๊อกกุ้ง/ล็อต/FIFO/LINE orders
│   └── shrimp-fix-customer-line.mjs   # ซ่อมข้อมูลลูกค้า LINE ฝั่งกุ้ง
│
├── docs/                              # เอกสารโครงสร้าง/สถาปัตยกรรม/สถานะคลาวด์
│   ├── PROJECT_STRUCTURE.md
│   ├── ARCHITECTURE_TH.md
│   ├── CHINCHA_FLOW_NAMING_TH.md
│   ├── CLOUD_STATUS.md
│   ├── LINE_OA_ORDER_SCOPE_TH.md
│   └── ENABLE_CLOUD_SCHEDULER.md
│
├── .github/workflows/                 # CI/CD บน GitHub Actions
│   ├── deploy-hosting.yml             # build + deploy hosting กุ้ง/ชา
│   ├── deploy-functions.yml           # deploy webhook-core
│   ├── deploy-rules.yml               # deploy Firestore/Storage rules
│   ├── tea-db-reset.yml               # reset DB ร้านชาแบบ cloud
│   └── shrimp-stock-reset.yml         # reset stock กุ้งแบบ cloud
│
├── .cursor/skills/                    # skill/context สำหรับ AI editor
├── .ops/                              # trigger/ops files สำหรับงานดูแลระบบ
├── firebase.json                      # Firebase hosting/functions/firestore config
├── firestore.rules                    # Firestore rules DB default
├── firestore-chincha.rules            # Firestore rules DB chincha legacy
├── storage.rules                      # Storage rules
├── package.json                       # npm workspaces + scripts รวม
└── README.md                          # หน้าแนะนำ repo นี้
```

> รายละเอียดเชิงลึกของโฟลเดอร์, แท็บ UI, Firestore collections และ flow สำคัญอยู่ที่ [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md)

---

## แอปกุ้ง: `apps/seafood-pos`

**หน้าที่หลัก:** POS กุ้งแม่น้ำ / รับสต๊อก / ย้ายกุ้งตาย / จัดการล็อต / ลูกค้า / ลูกหนี้ / รับออเดอร์จาก LINE / LIFF สำหรับลูกค้าและสลิป

**สแต็กหลัก**

- React 18 + Vite
- Firebase Auth + Firestore + Storage
- Firestore SDK + REST helper
- LINE LIFF (`@line/liff`)
- html2canvas สำหรับรูปบิล
- lucide-react สำหรับ icon

**โครง logic สำคัญ**

- `screens/` = หน้าใช้งานจริงของพนักงาน/แอดมิน
- `components/` = panel, sheet, ปุ่ม, banner, UI เฉพาะงาน
- `services/` = logic งานขาย/สต๊อก/ลูกหนี้/ลูกค้า/LINE order
- `lib/` = helper ชั้นล่าง เช่น date, REST, voice parsing, map LINE order เป็น sale
- `liff/` = flow จาก LINE เช่น ลูกค้าส่งออเดอร์/แนบสลิป/เลือกข้อมูล

**Firestore collections หลักฝั่งกุ้ง**

| Collection / Doc | ใช้ทำอะไร |
|---|---|
| `shrimp_users` | ผู้ใช้/พนักงานฝั่งกุ้ง |
| `config/stock` | สต๊อกกุ้งเป็น/ตายแบบ realtime |
| `stockBatches` | ล็อตรับเข้า, ราคา, FIFO, ค่ารถ |
| `sales` | บิลขายกุ้ง |
| `customerDebts` | ลูกหนี้ |
| `customers` | รายชื่อลูกค้า |
| `lineOrders` | ออเดอร์จาก LINE |
| `productSettings/shrimp` | ราคากุ้งและ config สินค้า |

---

## แอปร้านน้ำชินชา ไม้ขาว: `apps/chincha-tea`

**หน้าที่หลัก:** Smart POS ราคาแก้ว + ท็อปปิ้ง · สต๊อกแก้ว · สั่งของ · ประวัติ · แดชบอร์ดกำไร/สต๊อก (แอดมิน) · 3 ภาษา TH/MY/EN

**แท็บหลัก (พนักงานทุกคน):** ขาย · แก้ว · สั่งของ · ประวัติ

**เมนูแอดมิน ☰ (เมเนเจอร์/แอดมิน):** กำไร (แดชบอร์ด) · สโตสินค้า · จัดการ (สมาชิก/LINE)

**ตอกบัตร:** ยอดขายแรกของวันติ๊กพนักงานที่ขายอัตโนมัติ

**สแต็กหลัก**

- React 18 + Vite
- Firebase Auth + Firestore + Storage
- Firestore REST helper
- PWA manifest
- lucide-react สำหรับ icon
- ระบบ i18n 3 ภาษา: ไทย / เมียนมา / อังกฤษ

**โครง logic สำคัญ**

- `screens/` = แท็บหลักของร้านชา เช่น ขาย, หลังร้าน, สรุป, กำไร, ค่าแรง, แอดมิน
- `components/` = header, navigation, cart, menu card, modal ปรับแต่งแก้ว, voice command, staff panels
- `lib/` = service/helper เช่น auth session, order service, restock, slip upload, catalog, voice, LINE notify, i18n, constants

**Firestore collections หลักฝั่งชา**

| Collection / Doc | ใช้ทำอะไร |
|---|---|
| `users` | สมาชิกแอป, role, approved |
| `teaOrders` | บิลขายรายวัน |
| `dailyExpenses` | ค่าใช้จ่าย + สรุปยอดปิดวัน |
| `dailyCupStocks` | สต๊อกแก้วรายวัน |
| `restocks` | รายการสั่งของ/ซื้อของเข้าร้าน |
| `historyLogs` | ประวัติ action สำคัญ |
| `orderSlips` | รูปใบสั่งของ/สลิป |
| `products` / `toppings` | เมนูและ topping |
| `config/teaLine` | ตั้งค่า LINE สรุปปิดวัน |

---

## LINE backend: `apps/webhook-core`

Cloud Functions สำหรับงานหลังบ้านที่ไม่ควรอยู่ใน frontend โดยตรง

| Function / Module | หน้าที่ |
|---|---|
| `lineWebhook` | รับข้อความ LINE ฝั่งกุ้ง (OA 1:1 + กลุ่มครอบครัว) |
| `lineWebhookTea` | บอท LINE ชา — คำสั่งสรุป/ซื้อเข้าร้าน/help (กลุ่มร้านน้ำที่ตั้งในแอป) |
| `teaPushSummary` | ส่งสรุปปิดวันร้านชา (จากแอป) |
| `parseLineOrder.js` | แปลงข้อความลูกค้าเป็น order |
| `webhookDedup.js` | กัน LINE event ซ้ำ |
| `shrimpDailySummary.js` | สรุปยอดกุ้ง |
| `teaDailySummary.js` | สรุปยอดชา + คำสั่ง LINE |

### คำสั่ง LINE (อัปเดต 2026-06)

Webhook URL ใน LINE Developers:

| แอป | Function | URL |
|-----|----------|-----|
| กุ้ง | `lineWebhook` | `https://asia-southeast1-chincha-eeed6.cloudfunctions.net/lineWebhook` |
| ชา | `lineWebhookTea` | `https://asia-southeast1-chincha-eeed6.cloudfunctions.net/lineWebhookTea` |

**ชินชา (กลุ่มร้านน้ำ — ต้องตรง `config/teaLine.notifyGroupId` ในแอป)**

| พิมพ์ | ผลลัพธ์ |
|-------|---------|
| `สรุป` / `ปิดวัน` / `ยอดขายวันนี้` / `1` | สรุปยอดขายวันนี้ |
| `ซื้อเข้าร้าน` / `ซื้อของ` / `2` | รายการสั่งของ + ยอดซื้อแล้ว |
| `help` / `ช่วยเหลือ` / `3` | แสดงคำสั่ง |

**โกอ้วน — แชต OA 1:1 (ลูกค้า):** สั่งกุ้ง · `help` · `ฟอร์ม` · `ยกเลิก` · ส่งสลิป

**โกอ้วน — กลุ่มครอบครัว/พนักงาน:**

| พิมพ์ | ผลลัพธ์ |
|-------|---------|
| `1` / `สรุปออเดอร์` | รายการออเดอร์ LINE วันนี้ |
| `3` / `สรุป` / `ยอดขายวันนี้` | สรุปยอดขาย POS |
| `2` / `help` | คำสั่งกลุ่ม |
| `กุ้งใหญ่ 2 กก` (มีจำนวน) | รับออเดอร์ |

> แชททั่วไปในกลุ่ม — บอทเงียบ (ไม่รบกวน) ยกเว้นคำสั่งข้างบน

หลังแก้ `apps/webhook-core` ต้อง deploy functions (`main` push หรือ Actions → **Deploy Cloud Functions**)

## พัฒนา local

ติดตั้ง dependencies จาก root:

```bash
npm install
```

รันแอปชา:

```bash
npm run dev:tea
```

รันแอปกุ้ง:

```bash
npm run dev:seafood
```

Build:

```bash
npm run build --workspace=chincha-tea
npm run build --workspace=seafood-pos
npm run build --workspaces --if-present
```

---

## Deploy

Push ขึ้น `main` แล้ว GitHub Actions deploy ตาม path ที่เปลี่ยน:

- **Deploy Firebase Hosting** — กุ้ง / ชา
- **Deploy Cloud Functions** — LINE webhook
- **Deploy Firebase Rules** — Firestore + Storage rules

รันเองได้ที่ GitHub → **Actions** → เลือก workflow → **Run workflow**

---

## คำสั่งดูแลข้อมูล

### เคลียร์ข้อมูลร้านชา (Firestore)

ลบเฉพาะข้อมูลร้านชา ไม่แตะกุ้ง:

```bash
firebase login
gcloud auth application-default login --project chincha-eeed6
npm install
npm run tea:db-reset:dry
npm run tea:db-reset:all
```

บน Cloud: GitHub → Actions → **Tea DB Reset** → Run workflow  
รอบแรกเปิด dry run ก่อน แล้วรอบจริงปิด dry run + พิมพ์ `RESET` ใน `confirm_phrase`

### รีเซ็ตสต๊อกกุ้ง

```bash
gcloud auth application-default login --project chincha-eeed6
npm install
npm run shrimp:stock-reset:dry
npm run shrimp:stock-reset
npm run shrimp:stock-reset:full
```

Cloud: push ไฟล์ `.ops/TRIGGER_SHRIMP_FULL_RESET` หรือ Actions → **Shrimp Stock Reset**

LINE กุ้ง — Webhook URL ใน LINE Developers ต้องชี้ไปที่:

```text
https://asia-southeast1-chincha-eeed6.cloudfunctions.net/lineWebhook
```

ไม่ใช่ `lineWebhookTea`

---

## เอกสารเพิ่ม

- [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md) — โครงสร้างเต็ม + collections
- [docs/ARCHITECTURE_TH.md](docs/ARCHITECTURE_TH.md) — สถาปัตยกรรมระบบภาษาไทย
- [docs/CHINCHA_FLOW_NAMING_TH.md](docs/CHINCHA_FLOW_NAMING_TH.md) — ชื่อระบบ + คำเรียกสากล
- [docs/CLOUD_STATUS.md](docs/CLOUD_STATUS.md) — สถานะ hosting / functions
- [docs/LINE_OA_ORDER_SCOPE_TH.md](docs/LINE_OA_ORDER_SCOPE_TH.md) — ขอบเขต LINE OA order
- [docs/ENABLE_CLOUD_SCHEDULER.md](docs/ENABLE_CLOUD_SCHEDULER.md) — เปิด Scheduler สรุปอัตโนมัติ
