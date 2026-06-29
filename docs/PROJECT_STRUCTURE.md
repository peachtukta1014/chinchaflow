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
├── .claude
│   └── commands
│       ├── auto-shrimp.md
│       ├── auto-tea.md
│       ├── land-it.md
│       ├── peter-ser.md
│       ├── ship-shrimp.md
│       └── ship-tea.md
├── .github
│   └── workflows
│       ├── ai-workflow-trigger.yml
│       ├── code-metrics.yml
│       ├── deploy-functions.yml
│       ├── deploy-hosting.yml
│       ├── deploy-rules.yml
│       ├── pr-verify.yml
│       ├── shrimp-fix-line-customer.yml
│       ├── shrimp-full-reset-on-demand.yml
│       ├── shrimp-stock-reset.yml
│       ├── sync-project-tree.yml
│       └── tea-db-reset.yml
├── .jiiji
│   └── IDENTITY.md
├── 00_peach
│   └── i18n-3ภาษาเพิ่มเติม.md
├── apps
│   ├── ai-chat
│   │   ├── public
│   │   ├── src
│   │   ├── CHANGELOG.md
│   │   ├── index.html
│   │   ├── package.json
│   │   ├── postcss.config.js
│   │   ├── tailwind.config.js
│   │   └── vite.config.js
│   ├── chincha-tea
│   │   ├── .cursor
│   │   ├── lib
│   │   ├── public
│   │   ├── src
│   │   ├── AGENTS.md
│   │   ├── CHANGELOG.md
│   │   ├── index.html
│   │   ├── package.json
│   │   ├── postcss.config.js
│   │   ├── tailwind.config.js
│   │   └── vite.config.js
│   ├── seafood-pos
│   │   ├── .cursor
│   │   ├── docs
│   │   ├── public
│   │   ├── scripts
│   │   ├── src
│   │   ├── .env.example
│   │   ├── AGENTS.md
│   │   ├── CHANGELOG.md
│   │   ├── PATCH_SEAFOOD_DATEKEY.md
│   │   ├── index.html
│   │   ├── liff-order.html
│   │   ├── liff-slip.html
│   │   ├── package.json
│   │   ├── postcss.config.js
│   │   ├── tailwind.config.js
│   │   └── vite.config.js
│   ├── webhook-core
│   │   ├── assets
│   │   ├── scripts
│   │   ├── src
│   │   ├── AGENTS.md
│   │   ├── CHANGELOG.md
│   │   ├── DEVELOPER_GUIDELINES.md
│   │   ├── package.json
│   │   ├── shrimp-liff-id.json
│   │   ├── shrimp-liff-id.json.example
│   │   └── shrimp-liff-slip-id.json
│   └── webhook-core-scheduled
│       ├── src
│       └── package.json
├── docs
│   ├── AGENT_CHANGELOG_TH.md
│   ├── AGENT_HANDBOOK_TH.md
│   ├── AI_AGENT_DIAGRAM.md
│   ├── AI_AGENT_KEY_FILES.md
│   ├── ARCHITECTURE_TH.md
│   ├── CHINCHA_FLOW_NAMING_TH.md
│   ├── CODE_METRICS.md
│   ├── ENABLE_CLOUD_SCHEDULER.md
│   ├── LINE_LIFF_SETUP_TH.md
│   ├── LINE_OA_ORDER_SCOPE_TH.md
│   ├── LINE_OA_PARTITION_TH.md
│   ├── LINE_RICH_MENU_TH.md
│   ├── PEACH_WORKING_STYLE_TH.md
│   └── PROJECT_STRUCTURE.md
├── packages
│   └── app-credits
│       ├── src
│       └── package.json
├── reports
│   ├── code-metrics.json
│   └── code-metrics.md
├── scripts
│   ├── code-metrics.mjs
│   ├── materialize-cloud-env.sh
│   ├── shrimp-fix-customer-line.mjs
│   ├── shrimp-line-orders-prune.mjs
│   ├── shrimp-stock-reset.mjs
│   ├── sync-project-tree.mjs
│   └── tea-db-reset.mjs
├── .env.example
├── .firebaserc
├── .gitignore
├── 01-bug.yml
├── 02-feature.yml
├── 03-task.yml
├── AGENTS.md
├── CLAUDE.md
├── FLASH.md
├── PRO.md
├── README.md
├── config.yml
├── firebase.json
├── firestore-chincha.indexes.json
├── firestore-chincha.rules
├── firestore.indexes.json
├── firestore.rules
├── package.json
└── storage.rules
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
│   ├── App.jsx                    # auth gate (App) + AppShell — chat UI + session + polling
│   ├── icons.jsx                  # SVG icon components (named exports)
│   ├── LoginScreen.jsx            # Google Sign-in screen
│   ├── components/
│   │   ├── KnowledgePanel.jsx     # Knowledge tab (Custom Skills, Project Tree, Agent Docs)
│   │   └── TokenDashboard.jsx     # Token usage dashboard (grouped by day)
│   ├── api.js                     # chatWithAI · pollProgress · fetchResult · fetchDeployStatus
│   ├── firebase.js                # Firestore reads + Auth (Google Sign-in)
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

**ฟีเจอร์เด่น:** voice input · แนบรูป (vision) + ไฟล์ข้อความ · code-action เปิด PR อัตโนมัติ · auto-merge งาน low-risk · deploy banner แจ้งหลัง deploy เสร็จ · quick trigger (`โอเคกุ้ง`/`โอเคชา` → health check)

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
│   │   ├── RestockTab.jsx          # orchestrator — shared state/memos เท่านั้น
│   │   ├── RestockForm.jsx         # catalog picker + text input + submit
│   │   ├── RestockList.jsx         # pending list + exports RestockItemName/moneyLabel
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
│       ├── i18n.js               # รวม T + useLang() (import จาก i18n/ ด้านล่าง)
│       ├── i18n/                 # คำแปลแยกตามภาษา (ลดขนาดไฟล์ — เดิม i18n.js 1,558 บรรทัด)
│       │   ├── th.js             # ภาษาไทย
│       │   ├── my.js             # ภาษาเมียนมา
│       │   └── en.js             # ภาษาอังกฤษ
│       └── constants.js
│
├── .cursor/skills/                # Cursor skills (ไม่ใช้แล้ว — ดู /.claude/commands/ แทน)
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
│   │   ├── InventoryScreen.jsx    # orchestrator: navigation/history state + effects
│   │   ├── StockFilter.jsx        # ฟอร์มรับเข้า live/dead, ในบ่อ, spoilage
│   │   ├── StockBatchList.jsx     # display: ล็อตไทม์ไลน์ + ประวัติรับตาย
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
├── .cursor/skills/                # Cursor skills (ไม่ใช้แล้ว — ดู /.claude/commands/ แทน)
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
│   ├── index.js                   # exports functions ทั้งหมด (+ deployNotifyHttp)
│   ├── aiChatAgent.js             # AI chat agent (3-tier: Flash classify/แชท · Pro loop · Vision)
│   │                              #   + detectQuickTrigger() (โอเคกุ้ง/โอเคชา → health check)
│   │                              #   + ?action=deploy_status / progress / result
│   ├── aiWorkflowAgent.js         # agentic loop (commit/PR tools) + isHighRisk → auto-merge
│   ├── deployNotify.js            # writeDeployStatus/readDeployStatus → Firestore system/deploy_status
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
│   │   └── ...                    # อีก ~22 ไฟล์ (LIFF, slip, config, lexicon, etc.) — รวม ~36 ไฟล์
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
│       ├── agentTools.js          # orchestrator: agentic loop + OpenRouter caller
│       ├── toolDefinitions.js     # TOOL_DEFINITIONS array + constants
│       ├── toolExecutors.js       # fetchRepoFile + executeTool switch-case
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
| `aiChatAgentHttp` | AI chat + agentic loop (commit/PR) — entry point เดียวที่ ai-chat เรียก |
| `deployNotifyHttp` | รับสถานะ deploy จาก GitHub Actions (auth Bearer GH_PAT) → เขียน `system/deploy_status` |

### Firestore collections (AI agent + ระบบ)

| Collection / Doc | ใช้ทำอะไร |
|------------------|-----------|
| `aiProgress/{requestId}` | step ปัจจุบันของงาน — ai-chat poll ทุก 2 วิ (TTL สั้น) |
| `aiResults/{requestId}` | ผลลัพธ์สุดท้าย เผื่อแอปปิด/เน็ตหลุด — ดึงคืนด้วย `fetchResult` (TTL 30 นาที) |
| `agentRunLogs/{requestId}/steps` | log แต่ละรอบของ agent loop (ถาวร — ตรวจย้อนหลัง) |
| `system/deploy_status` | สถานะ deploy ล่าสุดของแต่ละแอป → ai-chat แสดง banner |

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
| `deploy-hosting.yml` | `apps/seafood-pos/**`, `apps/chincha-tea/**`, `apps/ai-chat/**` | Hosting ทุกแอป + แจ้งสถานะกลับ ai-chat (`deployNotifyHttp`) |
| `deploy-functions.yml` | `apps/webhook-core/**` | Cloud Functions + แจ้งสถานะกลับ ai-chat |
| `deploy-rules.yml` | `firestore*.rules`, `storage.rules` | Security rules |
| `pr-verify.yml` | ทุก PR | smoke test + syntax check + auto-merge PR ที่ติด `[auto-merge]` |
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
