# โครงสร้างโปรเจกต์ (Project Tree)

**CHINCHA FLOW** (ระบบรวม) · monorepo **chincha-business-os** · Firebase `chincha-eeed6` — [CHINCHA_FLOW_NAMING_TH.md](./CHINCHA_FLOW_NAMING_TH.md)

| แอป | URL Hosting | ผู้ใช้หลัก |
|-----|-------------|-----------|
| กุ้ง `seafood-pos` | https://ko-seafood.top | พนักงานร้านกุ้ง |
| ชา `chincha-tea` | https://chincha-tea.web.app | พนักงานร้านชา + แอดมิน |
| AI `ai-chat` | https://chincha-ai-chat.web.app | เจ้าของร้าน — คุย AI ผ่านเสียง/พิมพ์ |
| LINE `webhook-core` | Cloud Functions | บอท LINE กุ้ง/ชา + AI Chat Agent |

---

## ต้นไม้โปรเจกต์ (ภาพรวม)

> อัปเดตอัตโนมัติทุก push `main` โดย `sync-project-tree.yml` — ห้ามแก้มือระหว่าง markers

<!-- TREE_START -->
```
chinchaflow/
├── apps/                          # แอปหลัก (npm workspaces)
│   ├── seafood-pos/               # POS กุ้ง
│   ├── chincha-tea/               # POS ร้านชา/กาแฟ/ปั่น
│   ├── ai-chat/                   # AI Admin Chat PWA (Vite + React + tailwind)
│   ├── webhook-core/              # LINE webhook + AI Chat Agent + LIFF (Functions)
│   └── webhook-core-scheduled/    # สรุปชาอัตโนมัติ (ถ้า deploy แยก codebase)
│
├── packages/                      # shared packages (npm workspaces)
│   └── app-credits/               # AppCredits component (version badge)
│
├── scripts/                       # สคริปต์ดูแลข้อมูล (รันจาก root)
│   ├── code-metrics.mjs           # วัดขนาด repo / ความซับซ้อน → reports/
│   ├── materialize-cloud-env.sh   # สร้าง .env.local จาก Secret Manager
│   ├── shrimp-fix-customer-line.mjs   # แก้ LINE userId ลูกค้ากุ้ง
│   ├── shrimp-line-orders-prune.mjs   # ลบออเดอร์ LINE เก่า
│   ├── shrimp-stock-reset.mjs     # รีเซ็ตสต๊อก/ข้อมูลกุ้ง
│   ├── sync-project-tree.mjs      # re-gen tree section ใน PROJECT_STRUCTURE.md
│   └── tea-db-reset.mjs           # เคลียร์ข้อมูลร้านชา
│
├── reports/                       # ผลลัพธ์ auto-generated (จาก code-metrics workflow)
│   ├── code-metrics.json
│   └── code-metrics.md
│
├── docs/                          # คู่มือ / โครงสร้าง (อ้างอิงใน repo)
│   ├── PROJECT_STRUCTURE.md       # ไฟล์นี้ — อัปเดตทุกครั้งที่ไฟล์/โฟลเดอร์เปลี่ยน
│   ├── AGENT_CHANGELOG_TH.md      # log รอบที่แก้ (central)
│   ├── AGENT_HANDBOOK_TH.md
│   ├── ARCHITECTURE_TH.md
│   ├── CHINCHA_FLOW_NAMING_TH.md
│   ├── CLOUD_STATUS.md
│   ├── CODE_METRICS.md
│   ├── CURSOR_AGENT_SETUP_TH.md
│   ├── ENABLE_CLOUD_SCHEDULER.md
│   ├── LINE_LIFF_SETUP_TH.md
│   ├── LINE_OA_ORDER_SCOPE_TH.md
│   ├── LINE_OA_PARTITION_TH.md
│   ├── LINE_RICH_MENU_TH.md
│   └── PEACH_WORKING_STYLE_TH.md
│
├── .jiiji/                        # ตัวตน AI agent จีจี้ (Claude Code)
│   └── IDENTITY.md
│
├── .claude/                       # Claude Code slash commands (repo-wide)
│   └── commands/
│       ├── auto-shrimp.md
│       ├── auto-tea.md
│       ├── land-it.md
│       ├── peter-ser.md
│       ├── ship-shrimp.md
│       └── ship-tea.md
│
├── .cursor/                       # ตัวตน AI agent พี่เซอ (Cursor/Peter)
│   ├── environment.json
│   └── skills/                    # repo-wide skills
│       ├── auto-shrimp/SKILL.md
│       ├── auto-tea/SKILL.md
│       ├── land-it/SKILL.md
│       ├── peter-ser/SKILL.md
│       ├── ship-shrimp/SKILL.md
│       └── ship-tea/SKILL.md
│
├── .github/workflows/             # CI/CD (deploy แยกตาม path)
│   ├── code-metrics.yml           # วัด code metrics อัตโนมัติ → reports/
│   ├── sync-project-tree.yml      # auto-sync ต้นไม้ใน PROJECT_STRUCTURE.md
│   ├── deploy-hosting.yml         # build + deploy กุ้ง/ชา/ai-chat
│   ├── deploy-functions.yml       # deploy webhook-core
│   ├── deploy-rules.yml           # Firestore + Storage rules
│   ├── pr-verify.yml              # smoke test + build check บน PR
│   ├── shrimp-fix-line-customer.yml
│   ├── shrimp-full-reset-on-demand.yml
│   ├── shrimp-stock-reset.yml
│   └── tea-db-reset.yml
│
├── 00_peach/                      # โน้ตส่วนตัวพีช (ไม่ใช่ production code)
├── firebase.json                  # Hosting, Functions, Firestore config
├── firestore.rules                # rules DB (default) — ชา + กุ้ง
├── firestore.indexes.json
├── firestore-chincha.rules        # rules DB chincha (ชา legacy)
├── firestore-chincha.indexes.json
├── storage.rules
├── AGENTS.md                      # กฎ monorepo + สิ่งที่มีอยู่แล้ว
├── CLAUDE.md                      # กฎ Claude Code (พี่ซี)
├── JIIJI.md                       # ตัวตน + ความสามารถของจีจี้ (AI chat)
├── package.json                   # workspaces + scripts รวม
└── README.md
```
<!-- TREE_END -->

---

## แอป AI Chat `apps/ai-chat/`

**สแต็ก:** React 18 + Vite + Tailwind · PWA ปักหน้าจอได้ · Voice Input (Web Speech API) · คุยผ่าน Cloud Function

```
apps/ai-chat/
├── CHANGELOG.md
├── public/
│   ├── jiji-avatar.png            # avatar จีจี้ (แสดงใน chat bubble)
│   ├── jiji-icon.png              # icon สำหรับ PWA / tab
│   ├── peach-avatar.jpg           # avatar พีช (bubble ผู้ใช้)
│   └── manifest.json              # PWA
├── src/
│   ├── main.jsx                   # entry
│   ├── App.jsx                    # Chat UI — bubbles + voice input + scope picker + image attach
│   ├── api.js                     # คุยกับ Cloud Function aiChatAgentHttp (+ imageBase64)
│   ├── sessionStore.js            # เก็บ session history (localStorage)
│   ├── version.js                 # APP_VERSION (ai-DDMMYY.N) — inject อัตโนมัติตอน deploy
│   └── index.css                  # Tailwind base + scrollbar
├── index.html
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── package.json
```

**5 Agent Scopes (ปุ่มเลือกในแอป):** root (ทั่วไป) · tea (ชินชา) · seafood (โกอ้วน) · webhook (LINE Bot) · scheduled (Automation)

**Deploy:** `push main` → `deploy-hosting.yml` (job `deploy_ai_chat`) · URL: https://chincha-ai-chat.web.app

---

## แอปชา `apps/chincha-tea/`

**สแต็ก:** React 19 + Vite · Firestore REST + Firebase Auth/Storage · 3 ภาษา (TH / MY / EN)

```
apps/chincha-tea/
├── CHANGELOG.md
├── public/
│   ├── chincha-logo.jpg
│   └── manifest.json              # PWA
├── src/
│   ├── main.jsx
│   ├── App.jsx                    # login, แท็บ, ตะกร้า, routing หน้าหลัก
│   ├── firebase.js
│   │
│   ├── screens/
│   │   ├── LoginScreen.jsx
│   │   ├── OrderTab.jsx           # บันทึกขาย + เสียง + เมนู
│   │   ├── HistoryScreen.jsx
│   │   ├── SummaryTab.jsx         # สรุปยอดขาย / ค่าใช้จ่าย / ซื้อของ / LINE
│   │   ├── RestockTab.jsx
│   │   └── AdminPanel.jsx         # สมาชิก, เมนู, ท็อปปิ้ง, LINE config
│   │
│   ├── components/
│   │   ├── AppHeader.jsx
│   │   ├── TabNav.jsx
│   │   ├── CartSheet.jsx
│   │   ├── MenuCard.jsx
│   │   └── CustomizeModal.jsx
│   │
│   └── lib/
│       ├── firestoreRest.js
│       ├── authSession.js
│       ├── orderService.js
│       ├── orderSlipService.js
│       ├── restockService.js
│       ├── useCatalog.js
│       ├── voiceOrder.js
│       ├── lineNotify.js
│       ├── i18n.js
│       └── constants.js
│
├── .cursor/skills/                # app-scoped Cursor skills
│   ├── auto-tea/SKILL.md
│   ├── deploy-tea/SKILL.md
│   └── ship-tea/SKILL.md
├── index.html
├── vite.config.js
└── package.json
```

### Firestore collections (ชา — DB default)

| Collection | ใช้ทำอะไร |
|------------|-----------|
| `users` | สมาชิกแอป (approved, role) |
| `teaOrders` | บิลขายรายวัน |
| `dailyExpenses` | ค่าใช้จ่าย + สรุปปิดวัน |
| `dailyCupStocks` | สต๊อกแก้วเปล่ารายวัน |
| `restocks` | รายการสั่งของเข้าร้าน |
| `restockCatalog` | catalog ของเข้าร้าน + inventory |
| `historyLogs` | ประวัติ action สำคัญ |
| `orderSlips` | รูปใบสั่งของ/สลิป |
| `products` / `toppings` | เมนู |
| `config/teaLine` | ตั้งค่า LINE สรุปปิดวัน |

---

## แอปกุ้ง `apps/seafood-pos/`

**สแต็ก:** React + Vite · Firestore SDK + REST · LINE ออเดอร์ → ขาย

```
apps/seafood-pos/
├── CHANGELOG.md
├── public/
│   └── logo.jpg
├── scripts/
│   ├── smoke-test.mjs             # ตรวจ logic กุ้ง (ไม่ต้อง Firebase) — รันก่อน merge
│   ├── prepare-bill-template.mjs
│   └── rebuild-bill-templates-from-samples.mjs
├── src/
│   ├── main.jsx
│   ├── App.jsx                    # auth, แท็บล่าง, stock realtime
│   ├── firebase.js
│   │
│   ├── screens/
│   │   ├── LoginScreen.jsx
│   │   ├── POSMobile.jsx          # ขายของ + รูปบิล + เสียง
│   │   ├── Dashboard.jsx          # ภาพรวมวัน / ลูกหนี้
│   │   ├── SalesHubScreen.jsx     # hub ขายรวม (บิล + สลิป)
│   │   ├── InventoryScreen.jsx    # รับสต๊อก + ย้ายกุ้งตาย
│   │   ├── LotCloseScreen.jsx     # ปิดล็อตกุ้ง
│   │   ├── ExpensesScreen.jsx     # ค่าใช้จ่ายร้าน
│   │   ├── MembersScreen.jsx      # ลูกค้า + defaultRiverSize
│   │   ├── CustomerAccountsScreen.jsx  # บัญชีลูกค้า / ลูกหนี้
│   │   ├── LineOrdersScreen.jsx   # ออเดอร์ LINE → ส่งเรียบร้อย
│   │   ├── LineDeliveryConfirmSheet.jsx
│   │   ├── PaymentSlipsScreen.jsx # สลิปจ่ายเงิน
│   │   ├── MyProfileScreen.jsx
│   │   ├── ProductSettingsScreen.jsx
│   │   └── AdminUsersScreen.jsx
│   │
│   ├── components/
│   │   └── NavButton.jsx
│   │
│   ├── services/                  # business logic แยกจาก UI
│   │   ├── salesService.js        # saveBillWithCart, ตรวจสต๊อก
│   │   ├── stockService.js        # persist stock, stockBatches
│   │   ├── debtService.js
│   │   ├── customerService.js
│   │   └── lineOrderService.js
│   │
│   ├── hooks/
│   │   ├── useVoice.js            # Web Speech API — voice input
│   │   ├── useLineOrdersFeed.js
│   │   └── useSaleDeleteHandlers.js
│   │
│   ├── lib/                       # helpers (ไฟล์มาก — ดูได้จาก src/lib/)
│   │   ├── firestoreRest.js
│   │   ├── voiceParse.js
│   │   ├── lineOrderToSale.js
│   │   ├── date.js
│   │   └── ...                    # อีก ~50 ไฟล์ (bill, stock, line, etc.)
│   │
│   └── constants/
│
├── .cursor/skills/                # app-scoped Cursor skills
│   ├── auto-shrip/SKILL.md
│   ├── deploy-shrimp/SKILL.md
│   └── ship-shrimp/SKILL.md
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
| `customers` | รายชื่อลูกค้า + `defaultRiverSize` |
| `lineOrders` | ออเดอร์จาก LINE |
| `productSettings/shrimp` | ราคากุ้ง |

---

## LINE `apps/webhook-core/`

**สแต็ก:** Node 20 · Cloud Functions v2 · LINE Messaging API · OpenRouter AI

```
apps/webhook-core/
├── CHANGELOG.md
├── src/
│   ├── index.js                   # exports functions ทั้งหมด
│   ├── aiChatAgent.js             # AI chat agent (3-tier model: Flash/Pro/Vision)
│   ├── aiWorkflowAgent.js         # agentic loop (commit/PR tools)
│   │
│   ├── seafood-oa/                # LINE order handling — กุ้ง
│   │   ├── SCOPE.md
│   │   ├── parseLineOrder.js      # แปลงข้อความ → ออเดอร์
│   │   ├── shrimpLineOrderHandler.js  # tryCompleteOrder, group/DM flow
│   │   ├── shrimpGroupLineWebhook.js
│   │   ├── shrimpDirectLineWebhook.js
│   │   ├── customerRiverDefault.js    # defaultRiverSize → product name
│   │   ├── shrimpLineCustomerProfile.js
│   │   ├── prepareOrderInput.js
│   │   ├── translateOrderText.js
│   │   ├── parseDeliveryDate.js
│   │   ├── shrimpLineIntent.js
│   │   ├── shrimpDailySummary.js
│   │   ├── saveShrimpLineOrders.js
│   │   └── ...                    # อีก ~15 ไฟล์ (LIFF, slip, config, etc.)
│   │
│   ├── seafood-notify/            # push notification + bill render — กุ้ง
│   │   ├── SCOPE.md
│   │   ├── shrimpLinePush.js      # findCustomerNameByLineUserId, linkLine
│   │   ├── shrimpBillRender.js    # render บิล PNG (satori)
│   │   ├── shrimpBillPreRender.js
│   │   ├── shrimpBillTemplateRows.js
│   │   └── instantLineNotify.js
│   │
│   ├── tea/                       # LINE handling + summary — ชา
│   │   ├── SCOPE.md
│   │   ├── teaDailySummary.js
│   │   └── teaWebhook.js
│   │
│   └── shared/                    # utils ร่วม
│       ├── SCOPE.md
│       ├── agentTools.js          # tools สำหรับ AI agent (commit, read_file, etc.)
│       ├── lineUtils.js
│       ├── progressTracker.js
│       └── webhookDedup.js        # กัน event LINE ซ้ำ
│
└── package.json
```

| Function | หน้าที่ |
|----------|---------|
| `lineWebhook` | รับข้อความ LINE กุ้ง (DM + กลุ่ม) |
| `lineWebhookTea` | รับข้อความ LINE ชา |
| `teaPushSummary` | ส่งสรุปปิดวันชา |
| `aiChatAgentHttp` | AI chat (เจ้าของร้าน) |
| `aiWorkflowAgentHttp` | AI agentic workflow (commit/PR) |

---

## Shared Package `packages/app-credits/`

**AppCredits** — component แสดง version badge / credit strip ใน UI ทุกแอป

```
packages/app-credits/
├── src/
│   ├── index.js                   # exports หลัก
│   ├── AppCredits.jsx             # component หลัก
│   ├── CreditsStrip.jsx           # แถบ credit
│   ├── PlatformMark.jsx           # logo/platform mark
│   ├── creditsContent.js          # ข้อมูล credits
│   └── platformBrand.js           # brand config
└── package.json
```

---

## Deploy (GitHub Actions)

push `main` แล้วรันเฉพาะ workflow ที่ไฟล์เกี่ยวข้องเปลี่ยน:

| Workflow | เมื่อไฟล์เปลี่ยน | ผลลัพธ์ |
|----------|------------------|---------|
| `deploy-hosting.yml` | `apps/seafood-pos/**`, `apps/chincha-tea/**`, `apps/ai-chat/**` | Hosting ทุกแอป |
| `deploy-functions.yml` | `apps/webhook-core/**` | Cloud Functions |
| `deploy-rules.yml` | `firestore*.rules`, `storage.rules` | Security rules |
| `pr-verify.yml` | ทุก PR | smoke test + syntax check |
| `sync-project-tree.yml` | push `main` | auto-sync ต้นไม้ใน PROJECT_STRUCTURE.md |
| `code-metrics.yml` | push `main` | วัด metrics → `reports/` |
| `shrimp-fix-line-customer.yml` | manual | แก้ LINE userId ลูกค้ากุ้ง |
| `shrimp-full-reset-on-demand.yml` | manual | reset ข้อมูลกุ้งทั้งหมด |
| `shrimp-stock-reset.yml` | manual | รีเซ็ตสต๊อกกุ้ง |
| `tea-db-reset.yml` | manual | เคลียร์ DB ร้านชา |

รันมือ: GitHub → **Actions** → เลือก workflow → **Run workflow**

---

## คำสั่งที่ใช้บ่อย (จาก root)

```bash
npm install
npm run dev:tea              # พัฒนาแอปชา local
npm run dev:seafood          # พัฒนาแอปกุ้ง local
npm run build --workspace=chincha-tea
npm run build --workspace=seafood-pos
node apps/seafood-pos/scripts/smoke-test.mjs   # ตรวจ logic กุ้ง (ไม่ต้อง Firebase)
```

---

## กฎอัปเดตเอกสารนี้ (บังคับสำหรับ AI agent)

ทุก PR ที่ **เพิ่ม / ลบ / ย้าย** ไฟล์หรือโฟลเดอร์ → อัปเดต section ที่เกี่ยวในไฟล์นี้ใน PR เดียวกัน  
ถ้าไม่อัปเดต PROJECT_STRUCTURE จะ drift จากโค้ดจริง และ agent รอบต่อไปจะหลงทาง

ดูรายละเอียดเคลียร์ DB / รีเซ็ตสต๊อกใน [README.md](../README.md)
