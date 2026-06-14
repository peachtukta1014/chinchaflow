## 2026-06-14 — ชา: PR6 sync follow-up / กัน Voice จบบิลเอง

- ปรับ follow-up หลัง PR #262 ติดตามหลัง main: ใน environment นี้ไม่มี remote/main ให้ fetch จริง จึงแก้เฉพาะ conflict-risk ที่พบใน branch และคงงาน PR6 alias ไว้ครบ
- กันไม่ให้ Voice Flow ฝั่งขายชาเรียก `saveOrder()` / `onVoiceCommit` จากคำพูดประเภท `จบบิล`, `คิดเงิน`, `save order`; voice ตอนนี้ทำหน้าที่เพิ่มรายการเข้าตะกร้าเพื่อให้พนักงาน review และกดบันทึกเอง
- คง PR4 Role-based UI โดยไม่แตะ `teaRoles`/`navConfig` และคง PR6 alias mapping สำหรับ Search/Voice ผ่าน `productSearchTokens()` + `voiceAliasNames()`
- ถ้ามี conflict กับ main จริง ให้เก็บ entry PR5 Voice Review Flow จาก main ร่วมกับ entry PR6 นี้ใน `AGENT_CHANGELOG_TH.md` และเช็ก `apps/chincha-tea/src/screens/OrderTab.jsx`, `apps/chincha-tea/src/App.jsx`, `apps/chincha-tea/src/lib/voiceOrder.js`

## 2026-06-14 — ชา: PR6 Product Catalog and Alias Management

- เพิ่ม `products.aliases` เป็นรายการชื่อเรียกหลายแบบต่อสินค้า (รองรับไทย/พม่า/อังกฤษ) และยัง sync `voiceAliases` เดิมไว้เพื่อ backward compatible กับข้อมูลเก่า
- หน้า Admin > จัดการสินค้า แก้ alias ได้ใน modal เดิม: พิมพ์คั่น comma/ขึ้นบรรทัดใหม่, เห็น chip alias ใต้รายการสินค้า, และลบ alias รายตัวได้จาก chip
- หน้าขายค้นหาเมนูจาก alias ได้แล้ว โดยรวมชื่อไทย/อังกฤษ/พม่า/key/alias และแปลงข้อความพม่าผ่าน `burmeseToThai` เหมือนเดิม
- Voice Flow ใช้ alias mapping เดียวกันผ่าน `voiceAliasNames()` จึงพูดชื่อเรียกอื่น เช่น `ชาเย็น`, `Thai Tea`, `လက်ဖက်ရည်` แล้ว map เข้าสินค้าหลักได้
- ตะกร้า/บิลใหม่บันทึก `nameSnapshot` เป็นชื่อหลักของสินค้าเสมอ (`nameTh` เป็นหลัก) ไม่ใช้ alias; บิลเก่าที่มี snapshot เดิมยังอ่าน fallback เหมือนเดิม ไม่ migrate/ไม่กระทบยอดขายเก่า
- ถ้าพังอีกให้เช็ก `apps/chincha-tea/src/lib/productAliases.js`, `apps/chincha-tea/src/lib/voiceAliases.js`, `apps/chincha-tea/src/screens/AdminPanel.jsx`, `apps/chincha-tea/src/screens/OrderTab.jsx`, และ `apps/chincha-tea/src/components/CustomizeModal.jsx`

## 2026-06-12 — ชา: PR4 Role-based UI and Navigation

- จัด role navigation ฝั่งชาใหม่เป็น source เดียวผ่าน `teaRoles`/`navConfig`: admin เห็นครบทุกเมนู, manager เห็นงานประจำวัน + dashboard/history, staff เห็นขาย/หลังร้าน/บัญชีปิดกะ/โปรไฟล์เท่านั้น
- แตกเมนู admin ออกเป็นแท็บจริง (`dashboard`, `catalog`, `profit`, `payroll`, `history`, `admin`) และ render ด้วย guard เดียวกับ navigation เพื่อไม่ให้มีปุ่มที่กดแล้วค่อยโดนปฏิเสธสิทธิ์
- Header แสดงปุ่ม Admin เฉพาะ admin; manager/staff ไม่เห็นปุ่มระบบ และ dashboard quick links ซ่อนลิงก์ที่ role เข้าไม่ได้
- หน้าโปรไฟล์เพิ่มการ์ดสิทธิ์ผู้ใช้ แสดง role, userCode, branchId, สถานะอนุมัติ และเมนูที่ role นั้นมองเห็น
- ถ้าพังอีกให้เช็ก `apps/chincha-tea/src/lib/teaRoles.js`, `apps/chincha-tea/src/lib/navConfig.js`, `apps/chincha-tea/src/App.jsx`, `apps/chincha-tea/src/components/AppHeader.jsx`, `apps/chincha-tea/src/screens/DashboardTab.jsx`, และ `apps/chincha-tea/src/screens/MyProfileScreen.jsx`

## 2026-06-12 — ชา: PR3 Daily summary and header metrics

- เพิ่ม `dailySummaryService` เป็น source เดียวของสรุปวันชา รวมยอด POS, เงินสด/โอน, ยอดเหมา, จำนวนแก้วจริง, รายจ่าย, เงินทอน และแก้วคงเหลือจาก `dailyCupStocks`
- Header แอปชาแสดงยอดขายวันนี้และจำนวนแก้วขายวันนี้จาก summary กลาง และ refresh หลังบันทึกขาย/บันทึกยอดเหมา/บันทึกสรุปวัน
- ปรับ `SummaryTab`, `ExpensesTab`, Dashboard และ Profit ให้ใช้ summary กลางแทนคำนวณยอดขาย/แก้วคนละสูตร โดยไม่แตะ restock workflow, voice command, สูตรเมนู, seafood-pos หรือ webhook-core
- ถ้าพังอีกให้เช็ก `apps/chincha-tea/src/lib/dailySummaryService.js`, `apps/chincha-tea/src/App.jsx`, `apps/chincha-tea/src/screens/ExpensesTab.jsx`, และ `apps/chincha-tea/src/components/AppHeader.jsx`

## 2026-06-12 — ชา: PR2 Restock purchase workflow

- ปรับ `apps/chincha-tea` flow สั่งของให้แยก `pending` → `picked` → `pending_confirm` → `received`; ติ๊กหน้าใบสั่งเป็น picked เท่านั้น ยังไม่เพิ่ม stock
- บันทึกราคาซื้อรายรอบไว้ที่ใบสั่งก่อน และให้ stock/`latestUnitPrice` อัปเดตเฉพาะตอน admin ยืนยัน `received`
- หน้าใบสั่ง/รับเข้าแสดง row สั้น ชื่อสินค้า + จำนวน (-/ช่องตัวเลข/+) + ราคาล่าสุด/ราคาซื้อ โดยไม่เพิ่มรูปสินค้าและไม่แตะกุ้ง/webhook/voice/dashboard
- ถ้าพังอีกให้เช็ก `apps/chincha-tea/src/screens/RestockTab.jsx`, `apps/chincha-tea/src/lib/restockService.js`, และ field `purchaseStatus` / `purchaseItems` / `stock_base_qty` / `latestUnitPrice`

## 2026-06-12 — ชา: Backend Foundation role/user/restock received guard

- เพิ่ม foundation ผู้ใช้ฝั่งชา: role `admin` / `manager` / `staff`, `userCode` deterministic fallback, และ `branchId` ค่าเริ่มต้น `main` ผ่าน `teaUserService`
- เพิ่ม actor snapshot (`actor`, `userCode`, `branchId`) ใน history log, order, และ restock create/receive เพื่อ audit action สำคัญ
- เปลี่ยนสถานะ restock ใหม่เป็น `pending` / `picked` / `pending_confirm` / `received` / `cancelled`; สต๊อกจริงเข้าเฉพาะตอนแอดมิน mark เป็น `received` เท่านั้น (legacy `purchased` ยังอ่านเป็น received เพื่อไม่ทำข้อมูลเก่าพัง)
- ปรับ `firestore.rules` เฉพาะฝั่งชาให้รองรับ manager, ล็อก restock received/ต้นทุน/stock fields และกันพนักงานแก้ stock จริงใน `restockCatalog`
- ไม่แตะแอปกุ้ง, `webhook-core`, voice flow, dashboard/summary หรือ docs spec; ถ้าพังอีกให้เช็ก `apps/chincha-tea/src/lib/teaUserService.js`, `apps/chincha-tea/src/lib/restockService.js`, `apps/chincha-tea/src/screens/RestockTab.jsx`, และ `firestore.rules`

## 2026-06-11 — ชา: PR 3 Flexible POS Workflow + One-Page Closing

- เพิ่มฟอร์ม `บันทึกยอดเหมา` ในหน้าขายชา เก็บใน `dailyExpenses` ด้วย `type=bulkEntry`, `manualBulkTotal`, `manualCupsSold`, และ staff snapshot จาก login ปัจจุบัน
- ปรับ `SummaryTab`/`ExpensesTab` ให้หน้าปิดกะเป็น One-Page Form: เงินสด, เงินโอน, ยอดเหมา, รายจ่าย, เงินทอน, แก้วอัตโนมัติ, แก้วกรอกเอง, แก้วที่จะใช้หักสต๊อก
- สต๊อกแก้วเปล่าในหน้าปิดกะแสดง/บันทึก `openingCups + refillCups - finalCupsSold` โดย `finalCupsSold = manualCupsSold || autoCupsSold`
- ไม่แตะ RBAC, Navigation, Payroll, Profit Report, Firestore rules, หรือ Inventory Core นอกเหนือจาก daily cup stock เดิม
- ถ้าพังอีกให้เช็ก `apps/chincha-tea/src/screens/OrderTab.jsx`, `apps/chincha-tea/src/screens/ExpensesTab.jsx`, และ `apps/chincha-tea/src/lib/bulkEntryService.js`

## 2026-06-11 — ชา: PR 2 Smart Inventory Engine (Conversion & Ordering)

- เพิ่ม inventory fields ใน `restockCatalog`: `unit`, `base_unit`, `conversion_rate`, `stock_base_qty` เพื่อรองรับซื้อเป็นหน่วยใหญ่แต่ตัด stock เป็นหน่วยเล็กสุด
- `confirmPurchase`/ปุ่มแอดมิน「ซื้อแล้ว」รับของเข้าเป็นหน่วยซื้อ แล้วคูณ conversion เข้า `stock_base_qty` พร้อมบันทึก snapshot ใน `restocks.inventoryReceived`
- `saveTeaOrder` ตัดสต๊อกจาก base unit ของรายการแก้วใน `restockCatalog` หลังบันทึกบิล โดยจับ error ไว้ไม่ให้ flow ขายเดิมพัง
- ถ้าพังอีกให้เช็ก `apps/chincha-tea/src/lib/inventoryService.js`, `apps/chincha-tea/src/lib/restockService.js`, `apps/chincha-tea/src/screens/RestockTab.jsx`, และ field `stock_base_qty` ใน `restockCatalog`

## 2026-06-11 — ชา: แสดงราคาล่าสุดในหน้าสต๊อก/สั่งของ

- หน้า `หลังร้าน > สั่งของ` แสดง `ราคาล่าสุด` ต่อรายการใน catalog, รายการที่กำลังเลือก, และรายการสั่งของล่าสุด เพื่อเทียบราคาสินค้าได้ง่าย
- เมื่อแอดมินกด `ซื้อแล้ว` พร้อมใส่ราคาต่อชิ้น ระบบอัปเดตราคาล่าสุดกลับเข้า `restockCatalog` เพื่อใช้เทียบรอบถัดไป
- ถ้าพังอีกให้เช็ก `apps/chincha-tea/src/screens/RestockTab.jsx`, `apps/chincha-tea/src/lib/restockCatalogService.js`, และ field `latestUnitPrice` ใน `restockCatalog`

## 2026-06-11 — ชา: แยกสรุปวันออกจากค่าใช้จ่ายย่อย

- หน้า `บัญชี` ของชาเอาช่องรายจ่ายออกจากแท็บ `สรุปวัน` ให้เหลือเฉพาะยอดขาย/เงินสด/โอน/เงินทอน/จำนวนแก้ว
- ย้าย flow รายจ่าย เช่น `จ่ายออกหน้าร้าน` และ `ซื้อของเข้าร้านจากรายการสั่งซื้อ` ไปไว้ในแท็บ `จ่ายย่อย` พร้อมปุ่ม preset และคำอธิบายชัดเจน
- ลบการ์ดค่าใช้จ่าย/ยอดขายซ้ำใน `SummaryTab` เพื่อให้หน้าปิดวันสะอาดและไม่กรอกซ้ำ
- ถ้าพังอีกให้เช็ก `apps/chincha-tea/src/screens/ExpensesTab.jsx`, `apps/chincha-tea/src/screens/SummaryTab.jsx`, และ key ภาษาใน `apps/chincha-tea/src/lib/i18n.js`

## 2026-06-11 — ปรับแท็บค่าใช้จ่ายชาเป็นสรุปยอด + สต๊อกแก้ว

- แท็บ `apps/chincha-tea` → `ExpensesTab.jsx` แยก 3 โหมด: สรุปวัน, สต๊อกแก้ว, จ่ายย่อย
- `dailyExpenses.type=dailySummary` เก็บเงินสด/โอน/จ่ายหน้าร้าน/แก้วขายได้/ซื้อของจากสั่งของ/สรุปสุทธิ และยังแก้ย้อนหลังได้
- เพิ่ม collection `dailyCupStocks/{dateKey}` สำหรับยกยอดแก้ว, เติมแก้ว, เติมวันนี้รวม, คงเหลือ เพื่อยกยอดวันถัดไป
- ถ้าพังอีกให้เช็ก `ExpensesTab.jsx`, `firestore.rules`, และข้อมูล `dailyExpenses`/`dailyCupStocks` ของวันนั้น

# บันทึกงานที่แก้ล่าสุด (ให้เอเจนต์รอบถัดไป)

**อ่านไฟล์นี้ก่อน** เมื่อ Peach บอกว่ามีปัญหา / พัง / ใช้ไม่ได้ — โดยเฉพาะถ้าพูดถึงฟีเจอร์ที่เพิ่งแก้

กฎสั้น ๆ:

1. รอบใหม่ที่เกี่ยวข้อง → **เริ่มจาก entry ล่าสุดด้านล่าง** ว่ารอบก่อนแตะไฟล์/พฤติกรรมอะไร
2. หลัง merge งานที่แตะพฤติกรรมจริง → **เพิ่ม entry ใหม่** (PR นี้ ไม่ต้องยาว)
3. อย่าลบประวัติเก่า — เพิ่มด้านบนสุด (ใหม่ → เก่า)

---

## รูปแบบ entry (คัดลอกใช้)

```markdown
### YYYY-MM-DD — หัวข้อสั้น (PR #??? หรือ branch)

- **ปัญหา/คำขอ:** …
- **แก้แล้ว:** …
- **ไฟล์/จุดสำคัญ:** `path/...`
- **พฤติกรรมหลังแก้:** …
- **ถ้าพังอีก ให้เช็กก่อน:** …
```

---

## ประวัติ (ใหม่สุดอยู่บน)

### 2026-06-12 — กุ้ง: LINE กลุ่มเจอชื่อสินค้าแต่ไม่มีจำนวนให้เงียบ

- **ปัญหา/คำขอ:** แชทกลุ่มครอบครัวเช่น `พรุ่งนี้แหลมทราย กุ้งใหญ่ทั้งหมด` มีชื่อสินค้าแต่ไม่มีจำนวนกิโล ทำให้บอทหลุดไป fallback ตอบ help/เมนูยาว
- **แก้แล้ว:** เพิ่ม guard เฉพาะ group/room ให้ข้อความที่มี `กุ้งใหญ่/กลาง/เล็ก/ตาย/แม่น้ำ` แต่ไม่มีจำนวนหลังตัดวันส่งแล้วถูก skip เงียบ ไม่เรียก flow สร้าง `lineOrders` และไม่ตอบกลับ
- **ไฟล์/จุดสำคัญ:** `apps/webhook-core/src/shrimpGroupLineWebhook.js`, `apps/seafood-pos/scripts/smoke-test.mjs`
- **พฤติกรรมหลังแก้:** `กุ้งใหญ่ทั้งหมด` / `กุ้งใหญ่หมดบ่อ` เงียบในกลุ่ม แต่ `แหลมทราย กุ้งใหญ่ 5` / `แหลมทราย ใหญ่ 5` ยังรับเป็นออเดอร์ได้
- **ถ้าพังอีก ให้เช็กก่อน:** ต้อง deploy functions หลัง merge; ทดสอบด้วย `node apps/seafood-pos/scripts/smoke-test.mjs` และดูว่า log เป็น `group_product_without_quantity` โดยไม่มี `lineOrders` ใหม่

### 2026-06-11 — ชา: แท็บค่าใช้จ่ายบันทึกย้อนหลัง + สรุปเหมา

- **ปัญหา/คำขอ:** แท็บค่าใช้จ่ายเดิมบันทึกได้เฉพาะวันนี้และเป็นรายการเดี่ยว ทำให้กรอกย้อนหลัง/วางสรุปจากแชทแบบ `จ่าย 285` ไม่สะดวก
- **แก้แล้ว:** เพิ่มช่องวางสรุปจากแชทเพื่อดึงยอด `จ่าย`, เพิ่ม date picker ให้บันทึกย้อนหลัง, และแตะรายการเดิมเพื่อแก้ไขยอด/คำอธิบาย/วันที่ได้
- **ไฟล์/จุดสำคัญ:** `apps/chincha-tea/src/screens/ExpensesTab.jsx`, `apps/chincha-tea/src/lib/i18n.js`, `firestore.rules`, `docs/ARCHITECTURE_TH.md`
- **พฤติกรรมหลังแก้:** บันทึกลง collection เดิม `dailyExpenses` พร้อม `entryMode`, `createdByUid`, `updatedAt`, `updatedBy`; หน้ากำไร/สรุปที่อ่าน `amount/dateKey` ยังใช้ต่อได้เหมือนเดิม
- **ถ้าพังอีก ให้เช็กก่อน:** ดูว่า text จากแชทมีบรรทัด `จ่าย <ยอด>` หรือไม่ และตรวจสิทธิ์ PATCH/POST ของ `dailyExpenses` ใน Firestore

### 2026-06-11 — กุ้ง: แชทครอบครัวรับออเดอร์มีคำว่า “กุ้ง” แต่ไม่ใส่หน่วย

- **ปัญหา/คำขอ:** แชทครอบครัวพิมพ์ออเดอร์แบบ `มุขมณี กุ้งเล็ก 5` / `พี่อ้อม กุ้งเล็ก4` แล้วบอทไม่รับ เพราะ parser เดิมต้องมีหน่วยหลังคำว่า `กุ้งเล็ก/กลาง/ใหญ่`
- **แก้แล้ว:** ให้ parser กุ้งตีความตัวเลขหลังสินค้าเป็น `กก` อัตโนมัติเมื่อไม่ใส่หน่วย และให้ intent มองเป็นออเดอร์ในกลุ่มได้
- **ไฟล์/จุดสำคัญ:** `apps/webhook-core/src/parseLineOrder.js`, `apps/seafood-pos/scripts/smoke-test.mjs`
- **พฤติกรรมหลังแก้:** รูปแบบ `ชื่อลูกค้า กุ้งเล็ก 5`, `ชื่อลูกค้า กุ้งเล็ก5`, หรือหลายรายการติดกันจะถูกบันทึกเป็นกิโลกรัมเหมือนรูปแบบ `เล็ก 5`
- **ถ้าพังอีก ให้เช็กก่อน:** ต้อง deploy functions หลัง merge; ทดสอบด้วย `node apps/seafood-pos/scripts/smoke-test.mjs` และดู log `line_messages`/`lineOrders`

### 2026-06-10 — ชา: ล็อกราคาทุนสั่งของให้แอดมิน + แก้ส่งสรุป LINE จากแอป

- **ปัญหา/คำขอ:** แท็บสั่งของต้องใส่ราคาทุนรายชนิดเพื่อคำนวณต้นทุน แต่ให้เฉพาะ role แอดมินแก้/บันทึกได้; พนักงานดูราคาได้แต่ห้ามแก้ และปุ่มส่งสรุป LINE จากแอปขึ้น error Firebase default app / ส่งไม่ชัดเมื่อ Group ID มีปัญหา
- **แก้แล้ว:** ปุ่ม「ซื้อแล้ว」และการบันทึกราคาทุนเหลือเฉพาะแอดมิน, เพิ่ม Firestore rule กันพนักงานแก้ฟิลด์ราคาทุนโดยตรง, แสดงราคาทุนรายบรรทัดให้พนักงานดูอย่างเดียว, บังคับ Firebase client ใช้ default app ก่อนขอ ID token, และให้ Cloud Function แจ้ง `line_push_failed` เมื่อ push เข้า LINE ไม่สำเร็จ
- **ไฟล์/จุดสำคัญ:** `apps/chincha-tea/src/screens/RestockTab.jsx`, `apps/chincha-tea/src/lib/restockService.js`, `apps/chincha-tea/src/firebase.js`, `apps/chincha-tea/src/lib/lineNotify.js`, `apps/webhook-core/src/index.js`, `apps/webhook-core/src/teaDailySummary.js`, `firestore.rules`
- **พฤติกรรมหลังแก้:** แอดมินใส่ราคา/ชิ้นในแท็บสั่งของแล้วระบบรวมยอดซื้อเข้า; พนักงานเห็นราคาที่บันทึกแล้วแต่ไม่มีช่อง/ปุ่มบันทึกต้นทุน; ส่งสรุป LINE จะบอกให้รีเฟรชถ้า app เก่า หรือบอกเช็ก Group ID/บอทถ้า LINE push ล้มเหลว
- **ถ้าพังอีก ให้เช็กก่อน:** ต้อง deploy hosting + functions + rules; เช็ก `config/teaLine.notifyGroupId`, LINE OA อยู่ในกลุ่ม, และ env `LINE_TEA_CHANNEL_ACCESS_TOKEN`

### 2026-06-10 — กุ้ง: แยก LINE webhook direct/group router

- **ปัญหา/คำขอ:** `lineWebhook` กุ้งรวมทุก flow ไว้ใน `index.js` ทำให้แยกพฤติกรรมแชตตรงกับกลุ่มยาก และเสี่ยงตอบ help/LIFF ในกลุ่มเหมือนแชตตรง
- **แก้แล้ว:** คง export Cloud Function ชื่อ `lineWebhook` เดิม แต่ลดหน้าที่เหลือ verify signature, loop events, dedup/redelivery แล้วส่งเข้า `shrimpLineWebhookRouter`; แยก direct flow ไป `shrimpDirectLineWebhook.js` และ group/room flow ไป `shrimpGroupLineWebhook.js`
- **ไฟล์/จุดสำคัญ:** `apps/webhook-core/src/index.js`, `apps/webhook-core/src/shrimpLineWebhookRouter.js`, `apps/webhook-core/src/shrimpDirectLineWebhook.js`, `apps/webhook-core/src/shrimpGroupLineWebhook.js`, `apps/seafood-pos/scripts/smoke-test.mjs`, `docs/ARCHITECTURE_TH.md`
- **พฤติกรรมหลังแก้:** แชตตรงยังรับ follow/help/LIFF/cancel/สลิป/ออเดอร์ได้เหมือนเดิม; กลุ่ม/room รับเฉพาะรูปสลิปผ่าน group guard, summary/today_orders, และข้อความออเดอร์ ไม่ตอบ help/LIFF แบบ direct
- **ถ้าพังอีก ให้เช็กก่อน:** ดู router classify จาก `event.source.type` + `groupId`/`roomId` · รูปในกลุ่มต้องมีบิลค้างเปิด ไม่งั้น skip `group_image_without_open_bill` · LINE Console ยังยิง function `lineWebhook` ชื่อเดิม

### 2026-06-10 — กุ้ง: กัน LINE กลุ่มรับรูปทั่วไปเป็นสลิป

- **ปัญหา/คำขอ:** บอทในกลุ่มครอบครัวตอบ “รับสลิปแล้วครับ” แม้รูปที่ส่งไม่ใช่สลิป เช่น รูปอะไหล่/ของอื่น
- **แก้แล้ว:** รูปจากกลุ่มต้องผ่าน guard เพิ่ม: ไม่ใช่พนักงาน และผู้ส่งต้องมีบริบทบิลค้างเปิดอยู่จากประวัติ `lineBillPushes` ก่อน จึงดาวน์โหลด/อัปโหลด/บันทึก `paymentSlipSubmissions`; ถ้าไม่มีบริบทบิลค้างจะ skip เงียบ ไม่ตอบรับเป็นสลิป
- **ไฟล์/จุดสำคัญ:** `apps/webhook-core/src/shrimpPaymentSlip.js`, `apps/seafood-pos/scripts/smoke-test.mjs`, `docs/ARCHITECTURE_TH.md`
- **พฤติกรรมหลังแก้:** ลูกค้าที่เพิ่งได้รับบิลค้างยังส่งรูปสลิปในกลุ่มได้ แต่รูปทั่วไปจากสมาชิกกลุ่มที่ไม่มีบิลค้างจะไม่ขึ้นคิวสลิปและไม่ตอบข้อความรับสลิป
- **ถ้าพังอีก ให้เช็กก่อน:** `lineBillPushes` มี `lineUserId`/`billNo` ของลูกค้าหรือไม่ · บิลใน `sales` ยังเปิด (`remainingAmount > 0` หรือเครดิต) หรือถูกปิดแล้ว · UID พนักงานอยู่ใน `shrimp_users.lineUserId` หรือไม่

### 2026-06-08 — กุ้ง: ลดโควต้าเก็บออเดอร์ LINE ปิด 300 → 100

- **ไฟล์:** `lineOrderRetention.js` — `LINE_ORDER_RETENTION_KEEP = 100`
- นโยบายเดิม: เก็บ done (มีบิล)/cancelled ล่าสุด · ไม่แตะ pending/delivering

### 2026-06-07 — กุ้ง: ล้างออเดอร์ LINE เก่า (เก็บ 300 รายการ)

- **ปัญหา/คำขอ:** ออเดอร์ LINE ปิดสะสมใน Firestore · อยากลบเก่าออกจากคลังข้อมูล (ยอดขาย/รายปีไม่กระทบ)
- **แก้แล้ว:**
  - นโยบาย: เก็บออเดอร์ปิด (done/cancelled) ล่าสุด **300** รายการ · ไม่แตะ pending/delivering
  - done ลบได้เฉพาะที่มี `salesId` หรือ `billNo` · cancelled ลบได้
  - แอดมิน: แท็บสมาชิก → panel「ล้างออเดอร์ LINE เก่า」เช็กจำนวน + ลบ
  - CLI: `node scripts/shrimp-line-orders-prune.mjs --dry-run` / `--confirm`
- **ไฟล์/จุดสำคัญ:** `lineOrderRetention.js`, `lineOrderRetentionService.js`, `LineOrderRetentionPanel.jsx`, `scripts/shrimp-line-orders-prune.mjs`
- **พฤติกรรมหลังแก้:** บอร์ดออเดอร์รอส่งยังเหมือนเดิม · บิลใน `sales` ไม่ถูกลบ · รายปี/Lot ไม่กระทบ
- **ถ้าพังอีก ให้เช็กก่อน:** ต้อง login เป็น **admin** กุ้ง (firestore rules delete lineOrders) · CLI ต้อง `gcloud auth application-default login`

### 2026-06-07 — กุ้ง: โปรไฟล์สมาชิก (รูป / ชื่อ / เบอร์ / รหัสผ่าน)

- **ปัญหา/คำขอ:** สมาชิกอยากมีรูปโปรไฟล์ข้างชื่อ · แก้ชื่อเล่น เบอร์โทร · เปลี่ยนรหัสผ่านเอง (ไม่เปลี่ยนอีเมล)
- **แก้แล้ว:**
  - หน้า `MyProfileScreen` — ทุก role เข้าได้ (แตะรูป/ชื่อใน header)
  - อัปโหลดรูป → Storage `shrimpAvatars/{uid}.jpg` + `shrimp_users.photoUrl`
  - แก้ `name` / `phone` ใน Firestore · เปลี่ยนรหัสผ่านผ่าน Firebase Auth (ต้องใส่รหัสเดิม)
  - `MemberAvatar` ใน header + รายชื่อสมาชิกแอป
  - กฎ: สมาชิกแก้ doc ตัวเองได้แต่ห้ามเปลี่ยน `email` / `role` / `approved`
- **ไฟล์/จุดสำคัญ:** `MyProfileScreen.jsx`, `shrimpProfileService.js`, `MemberAvatar.jsx`, `storage.rules`, `firestore.rules`
- **พฤติกรรมหลังแก้:** แตะชื่อมุมซ้ายบน → โปรไฟล์ · อีเมลอ่านอย่างเดียว
- **ถ้าพังอีก ให้เช็กก่อน:** deploy **hosting + storage rules + firestore rules** · รูปไม่ขึ้น = เช็ก Storage permission

### 2026-06-07 — กุ้ง: pre-render บิล + เร่ง LIFF สลิป (branch cursor-พี่เซอperf-slip-prerender-f8e2)

- **ปัญหา/คำขอ:** ส่งบิล LINE ช้า (render ตอน push) · LIFF ฝากสลิปช้า · กลัวแจ้งเตือนสลิปหลุดไปลูกค้าเหมือนรอบ #202
- **แก้แล้ว:**
  - `shrimpBillPreRender` + HTTP `shrimpPreRenderBill` — เจนภาพบิลเก็บ `billImageUrl`/`billImageKey` บน `sales/{id}` หลัง save
  - Client `scheduleShrimpBillPreRender` หลังออกบิล (POS / LINE delivery / offline sync) · `shrimpLinePush` ใช้ cache ก่อน render ใหม่
  - LIFF สลิป: `compressImageFile` ก่อนอัปโหลด · `liff.sendMessages` fire-and-forget · ปิดหน้าต่าง 500ms
  - `shrimpPaymentSlip`: แก้ `hintBill` TDZ · parallel upload+metadata · **ลบ inline notify** — แจ้ง staff ผ่าน `onShrimpPaymentSlipCreated` + `resolveSlipNotifyTargets` เท่านั้น
  - ยืนยันสลิป: invalidate cache + pre-render บิลชำระแล้วก่อน LINE push
- **ไฟล์/จุดสำคัญ:** `shrimpBillPreRender.js`, `shrimpLinePush.js`, `shrimpPaymentSlip.js`, `LineSlipLiffApp.jsx`, `shrimpBillApi.js`, `paymentSlipService.js`
- **พฤติกรรมหลังแก้:** ส่งบิล LINE เร็วขึ้นเมื่อมี cache · สลิป LIFF ตอบเร็วขึ้น · แจ้งเตือนสลิปไปกลุ่ม staff ไม่ไป UID ผู้ส่งสลิป
- **ถ้าพังอีก ให้เช็กก่อน:** deploy **functions + hosting** ทั้งคู่ · ถ้าแจ้งเตือนซ้ำ = เช็กว่า `recordPaymentSlipSubmission` ไม่เรียก `notifyShrimpPaymentSlip` อีก · cache บิลผิด = ดู `billImageKey` บน sale doc

### 2026-06-06 — กุ้ง: LIFF ฟอร์มสั่งกุ้ง — วันส่งตาม cutoff (branch cursor-พี่เซอperf-bill-slip-7240)

- **ปัญหา/คำขอ:** ลูกค้าสั่ง LIFF ตอน 23:56 เลือก「วันนี้」= 6/6 → ระบบรับ 6/6 → ขึ้นค้างส่ง (เลยวันแล้ว) ทั้งที่จริงส่งวันถัดไป
- **สาเหตุ:** LIFF ฟอร์ม `deliveryKey = todayKey()` ตายตัว ไม่ตรวจ cutoff · server ก็รับ date ที่ client ส่งมาเลย
- **แก้แล้ว:**
  - `shrimpLiffOrderSubmit`: `submitLiffOrder` clamp `deliveryDate >= minDelivery` (cutoff เดียวกับ LINE OA)
  - `shrimpLiffOrderSubmit`: `getLiffContext` คืน `deliveryEndHour` ให้ frontend
  - `LineOrderLiffApp`: `earliestDeliveryKey(endHour)` — วันนี้ก่อน cutoff, พรุ่งนี้หลัง cutoff
  - ปุ่ม「วันนี้」เปลี่ยน label เป็น「พรุ่งนี้」+ แสดง note เตือนเมื่อเลยเวลา
- **ไฟล์/จุดสำคัญ:** `shrimpLiffOrderSubmit.js`, `LineOrderLiffApp.jsx`
- **พฤติกรรมหลังแก้:** สั่งหลัง 14:00 → ฟอร์มแสดง「พรุ่งนี้ (เร็วที่สุด)」· server clamp วันอัตโนมัติแม้ client ส่งผิด
- **ถ้าพังอีก ให้เช็กก่อน:** deploy **hosting + functions** ทั้งคู่ · `lineDefaultEndHour` ใน `config/shrimpLine`

### 2026-06-06 — กุ้ง: cache ภาพบิล + ปุ่มบันทึกรูปลงคลังภาพ iOS (branch cursor-พี่เซอperf-bill-slip-7240)

- **ปัญหา/คำขอ:** เปิดบิลเดิมซ้ำยัง load ใหม่จาก Cloud Function · ปุ่ม「บันทึกรูป」ต้องแชร์แล้วเลือกบันทึกแทน
- **แก้แล้ว:**
  - `shrimpBillApi`: cache blob ต่อ saleId TTL 5 นาที — เปิดบิลเดิมครั้งที่ 2+ โหลดทันที
  - `generateBillImage`: `saveOrShareBillImage()` — iOS ใช้ `navigator.share({ files })` ให้ขึ้น share sheet「บันทึกภาพ」ตรงๆ
  - `BillImageSheet`: ปุ่ม「บันทึกรูป」ใช้ saveOrShareBillImage แทน download link
- **ไฟล์/จุดสำคัญ:** `shrimpBillApi.js`, `generateBillImage.js`, `BillImageSheet.jsx`
- **พฤติกรรมหลังแก้:** เปิดบิลซ้ำ = instant · iOS กด「บันทึกรูป」ขึ้น share sheet เลือก「บันทึกภาพ」ได้เลย
- **ถ้าพังอีก ให้เช็กก่อน:** iOS ต้องเป็น Safari >=15 / PWA จาก Safari จึงจะมี `navigator.canShare`; Android Chrome รองรับ · ถ้า share ล้ม fallback download ทำงาน

### 2026-06-06 — กุ้ง: ลด lag ยืนยันสลิป + เจนภาพบิล (branch cursor-พี่เซอperf-bill-slip-7240)

- **ปัญหา/คำขอ:** กดยืนยันสลิปคืนลูกค้าช้า · เปิดภาพบิลฟอร์มจ่ายแล้วช้า · บิลเจนช้าทำทุก save หน่วงตาม
- **สาเหตุ:**
  1. `confirmPaymentSlip` รอ Cloud Fn render bill + LINE push (~5-10s) ก่อน mark slip = confirmed
  2. `BillImageSheet` โหลด 300 customers จาก Firestore 2 ครั้งแยก (image load + UID lookup)
  3. ไม่มี cache สำหรับ `loadMergedCustomers` — ทุก open BillImageSheet โหลดซ้ำ
- **แก้แล้ว:**
  - `paymentSlipService`: mark slip `confirmed` ก่อน → คืน UI ทันที → push LINE ต่อในพื้นหลัง (`pushPaidBillToLineBackground`)
  - `resolveLineUserId`: `loadMergedCustomers` มี in-flight dedup + cache 60s
  - `BillImageSheet`: รวม 2 useEffect → resolve customer 1 ครั้ง → image + UID lookup ขนาน
- **ไฟล์/จุดสำคัญ:** `paymentSlipService.js`, `PaymentSlipsScreen.jsx`, `resolveLineUserId.js`, `BillImageSheet.jsx`
- **พฤติกรรมหลังแก้:** กดยืนยันสลิปกลับทันที (<2s) · เปิดภาพบิลรอแค่ Cloud Fn render · UID lookup เร็วขึ้นเพราะ cache
- **ถ้าพังอีก ให้เช็กก่อน:** `pushPaidBillToLineBackground` log warn ใน console หาก push ล้ม (ไม่ error ผู้ใช้)

### 2026-06-06 — Hardening ความเสี่ยงทั้งหมด (PR #202–#205)

- **ปัญหา/คำขอ:** code review พบ 7+ จุดเสี่ยง (Critical/High) ใน webhook + LINE + stock
- **แก้แล้ว (รอบนี้):**
  - #202: notify UID leak + hintBill TDZ + isFamilyGroup จาก config + webhook retry (completeLineEvent ก่อน lineReply) + _updateTime ใน fsListCollection/docFromRow สำหรับ FIFO optimistic lock
  - #203: verifySignature fail-closed เมื่อไม่มี LINE_CHANNEL_SECRET
  - #204: beginLineOrderDelivery ใช้ fsPatchIf + updateTime (CAS กัน 2 เครื่องสร้างบิลซ้ำ)
  - #205: LIFF slip dedup ด้วย crypto.randomUUID() idempotency key
- **ไฟล์/จุดสำคัญ:** `instantLineNotify.js`, `shrimpGroupKeyboard.js`, `index.js`, `shrimpPaymentSlip.js`, `firestoreRest.js`, `lineOrderService.js`, `shrimpLiffSlip.js`, `LineSlipLiffApp.jsx`
- **พฤติกรรมหลังแก้:** ออเดอร์ LINE ไม่ซ้ำจาก retry · stock FIFO optimistic lock ทำงาน · บิลซ้ำ 2 เครื่องถูกกัน · LIFF slip dedup ทำงาน
- **ถ้าพังอีก ให้เช็กก่อน:** deploy **ทั้ง hosting + functions** · `LINE_CHANNEL_SECRET` ตั้งค่าใน Functions env

### 2026-06-06 — LIFF ฝากสลิป: เซสชันหมดอายุตอนกดส่ง (ไม่เกี่ยว LINE Peach)

- **ปัญหา/คำขอ:** หน้า `liff-slip.html` ล็อกอินได้ แต่กด「ส่งสลิป」ขึ้น「เซสชันหมดอายุ — ปิดแล้วเปิดใหม่」
- **สาเหตุ:** `shrimpLiffSlip` อ่าน `verified.sub` แต่ `verifyLineLiffIdToken` คืน `lineUserId` → `invalid_id_token` ทุกคน (ไม่ใช่เพราะใช้บัญชี Peach)
- **แก้แล้ว:** ใช้ `verified.lineUserId` เหมือน `shrimpLiffOrderSubmit` · regression test ใน `test-shrimp-liff-slip.js`
- **ไฟล์/จุดสำคัญ:** `apps/webhook-core/src/shrimpLiffSlip.js`
- **พฤติกรรมหลังแก้:** ส่งสลิปผ่าน LIFF บันทึกคิว `paymentSlipSubmissions` ได้ · **ต้อง deploy functions** (`shrimpLiffSlip`) ไม่ใช่แค่ hosting
- **ถ้าพังอีก ให้เช็กก่อน:** `LINE_LOGIN_CHANNEL_ID` / `LINE_LIFF_ID` ใน functions env · ทางลัดส่งรูปในแชต OA ยังใช้ได้

### 2026-06-05 — LINE กลุ่ม: สองลูกค้าในข้อความเดียวรวมเป็นออเดอร์เดียว

- **ปัญหา/คำขอ:** กลุ่ม LINE พิมพ์ 2 รายชื่อ (รูปแบบสั้น ปุ้ย กลาง 2 / จะเขียด กลาง 3) บอทรับออเดอร์รวมชื่อเดียว
- **แก้แล้ว:** `parseSimpleOrderItems` แยกทีละบรรทัด · ห้าม `parseSimpleOrderLine` แมตช์ข้อความหลายบรรทัดรวม · handler ไม่ทับ `parseOrderItems` เมื่อมีหลายรายการแล้ว
- **ไฟล์:** `parseLineOrder.js`, `shrimpLineOrderHandler.js`, `scripts/test-parse-multi-customer.js`
- **พฤติกรรมหลังแก้:** 2 บรรทัดรูปแบบสั้น → 2 `lineOrders` · ตอบ `(2 ราย)`
- **ถ้าพังอีก ให้เช็กก่อน:** รูปแบบ `ปุ้ย 2` หลายบรรทัด (ยังไม่มีขนาด) → pending ทีละคน · deploy `deploy-functions.yml`

### 2026-06-05 — กุ้ง: บิล Cloud — หัวบิลกล่อง + เบอร์/ที่อยู่ว่าง

- **ปัญหา/คำขอ:** หัวบิลยังมี □ (emoji 📞) · เบอร์/ที่อยู่ลูกค้าจากรายชื่อไม่ขึ้นบนบิล Cloud
- **แก้แล้ว:** หัวบิลใช้ `โทร.` แทน emoji · `fetchShrimpBillImage` / `BillImageSheet` เรียก `resolveBillCustomer` (โหลด Firestore + จับชื่อ alias เช่น เจ๊เขียด→c1)
- **ไฟล์:** `resolveBillCustomer.js`, `shrimpBillApi.js`, `BillImageSheet.jsx`, `shrimpBillRender.js`

### 2026-06-05 — กุ้ง: ฟอนต์บิล Cloud ขึ้นกล่อง (Satori)

- **ปัญหา/คำขอ:** ภาพบิลจาก `shrimpRenderBill` ตัวเลข/วันที่/หัวตารางเป็น □
- **แก้แล้ว:** ใช้ Sarabun **TTF เต็มชุด** ใน `apps/webhook-core/assets/fonts/` แทน subset woff จาก `@fontsource` (Satori ไม่รวม unicode-range แบบ CSS)
- **ไฟล์:** `shrimpBillRender.js`, `assets/fonts/Sarabun-*.ttf`

### 2026-06-05 — กุ้ง: วาดบิล + ส่ง LINE บน Cloud (Satori)

- **ปัญหา/คำขอ:** ส่งบิล LINE ช้า ~10 วิ — มือถือ html2canvas + อัปโหลด base64 ใหญ่
- **แก้แล้ว:** แอปส่ง `billData` (จาก `saleToBillData`) → Functions วาดด้วย Satori+Resvg → Storage → LINE · preview ใช้ `shrimpRenderBill` · fallback html2canvas ถ้า Cloud ล้ม
- **ไฟล์/จุดสำคัญ:** `webhook-core/src/shrimpBillRender.js`, `shrimpBillTemplateRows.js`, `shrimpRenderBill`, `shrimpPushBill` · `seafood-pos/src/lib/shrimpBillApi.js`, `linePushBill.js`, `BillImageSheet`, `LineShareButton`, `paymentSlipService`
- **พฤติกรรมหลังแก้:** ต้อง deploy **ทั้ง** functions (`deploy-functions.yml`) และ hosting กุ้ง — ฝั่ง client เก่ายังส่ง base64 ได้จนกว่าจะอัปเดต
- **ถ้าพังอีก ให้เช็กก่อน:** ฟอนต์ TTF ใน `webhook-core/assets/fonts/` (subset woff ทำให้ขึ้นกล่อง) · `SHRIMP_PUBLIC_ORIGIN` โหลด logo/QR · memory `1GB`

### 2026-06-05 — กุ้ง: ชีตส่ง LINE ไม่รีเซ็ตน้ำหนักที่พิมพ์

- **ปัญหา/คำขอ:** ใส่ 4.3 กก. สักพักกลับเป็น 4 ตามที่สั่ง (ก่อนกดบันทึก)
- **แก้แล้ว:** `LineDeliveryConfirmSheet` รีเซ็ตตะกร้าเฉพาะตอนเปิดออเดอร์ใหม่ — ไม่รีเซ็ตเมื่อ `allCustomers`/แนะนำลูกค้าโหลดทีหลัง
- **หมายเหตุ:** ไม่เกี่ยวกับ snapshot (#183) — snapshot อัปเดตรายการออเดอร์ ไม่ได้แก้ชีตส่งของ
- **ไฟล์:** `LineDeliveryConfirmSheet.jsx`

### 2026-06-05 — กุ้ง: ออเดอร์ LINE real-time (snapshot)

- **ปัญหา/คำขอ:** ออเดอร์ใหม่/ส่งแล้วไม่อัปเดตทันที — poll 30–45 วิช้า
- **แก้แล้ว:** `subscribeLineOrdersBoard` (Firestore `onSnapshot` pending+delivering) แชร์ทั้งบอร์ด+badge · ล้มเหลว → REST ทุก 60 วิ · rules รองรับ `deliveringAt/By`, สลิป `confirming`
- **ไฟล์/จุดสำคัญ:** `lineOrdersFeed.js`, `useLineOrdersFeed.js`, `LineOrdersScreen.jsx`, `App.jsx`, `firestore.rules`, `lineOrderBoard.js`
- **พฤติกรรมหลังแก้:** ออเดอร์ LINE ขึ้น/หายทันทีเมื่อ webhook หรือเครื่องอื่นบันทึก · ปริมาณ ~10–22 บิล/วัน ไม่ต้อง paginate เพิ่ม
- **ถ้าพังอีก ให้เช็กก่อน:** login Firebase ในแอป · listener error ใน console → fallback REST

### 2026-06-05 — กุ้ง: เสถียรภาพรอบ 2 (ลูกหนี้, poll, lock, สลิป)

- **ปัญหา/คำขอ:** เคลียร์ medium จากรีวิว — AR cap 120, poll 30s, สองเครื่องส่งซ้ำ, สลิป/slip state, FIFO stale, sync stock เงียบ
- **แก้แล้ว:** `fsQueryOpenSales`/`fsQuerySalesByCustomer` แบ่งหน้า · FIFO re-read บิลก่อนหัก · `beginLineOrderDelivery` lock · สลิป `confirming` ก่อนปิดบิล · บอร์ดเฉพาะ pending/delivering + ลบออกทันหลังส่ง · poll 45s + pause เมื่อแท็บซ่อน · `syncMainStockFromBatches` log warn
- **ไฟล์/จุดสำคัญ:** `firestoreRest.js`, `salesService.js`, `lineOrderService.js`, `LineOrdersScreen.jsx`, `paymentSlipService.js`, `useIntervalWhen.js`
- **ถ้าพังอีก ให้เช็กก่อน:** Firestore index `sales` remainingAmount+createdAt · `lineOrders` status+createdAt · สถานะ `delivering` ค้าง >5 นาที

### 2026-06-05 — กุ้ง: ส่งของ LINE คืนสต๊อกถูก + กันบิลซ้ำ + บอร์ดไม่ตัดค้างเก่า

- **ปัญหา/คำขอ:** บันทึกส่ง LINE ล้มเหลวแล้วคืนสต๊อกผิด (state เก่า) · กดซ้ำสร้างบิลซ้ำ · ออเดอร์ค้าง >7 วันหายจากบอร์ด · query cap 100
- **แก้แล้ว:** `computeStockAfterSaleDeduction` + restore ด้วยยอดหลังตัด · `saveLineOrderDelivery` idempotent + `fsQuerySaleByLineOrderId` · `filterPendingLineOrdersForBoard` (ไม่ตัด min 7 วัน) · `fsQueryAllPendingLineOrders` แบ่งหน้า
- **ไฟล์/จุดสำคัญ:** `stockService.js`, `LineOrdersScreen.jsx`, `lineOrderService.js`, `lineOrderBoard.js`, `firestoreRest.js`
- **พฤติกรรมหลังแก้:** ค้างส่งทุกอายุยังขึ้นบอร์ด (ซ่อนแค่ส่งล่วงหน้า >14 วัน) · timeout กดซ้ำไม่สร้าง sale ซ้ำ
- **ถ้าพังอีก ให้เช็กก่อน:** index `lineOrders` status+createdAt · บิลค้าง `lineOrderId` ใน sales

### 2026-06-05 — ถอน Vercel ออกจาก repo (ไม่มีในโค้ด)

- **ปัญหา/คำขอ:** ลบลิงก์ Vercel บนหัว GitHub repo / ไม่ใช้ Vercel deploy
- **แก้แล้ว:** workflow `disconnect-vercel-github.yml` (รันมือครั้งเดียว) · เอกสารใน `CLOUD_STATUS.md`
- **ไฟล์/จุดสำคัญ:** `.github/workflows/disconnect-vercel-github.yml`, `docs/CLOUD_STATUS.md`
- **พฤติกรรมหลังแก้:** homepage repo ว่าง · ไม่มี environment Preview/Production จาก Vercel (หลังรัน workflow)
- **ถ้าพังอีก ให้เช็กก่อน:** ยังผูก Vercel ที่ vercel.com / GitHub Integrations → disconnect ตามขั้นใน CLOUD_STATUS

### 2026-06-04 — กุ้ง: LIFF ฝากสลิป + Rich Menu B (branch cursor-พี่เซอliff-slip-deposit-ea63)

- **ปัญหา/คำขอ:** ลูกค้าอายุมากหุบ Rich Menu ไม่เป็น — หา 📎 ส่งสลิปยาก · ต้องการหน้าฝากสลิปแบบ LIFF + ลิงก์ในบิลค้าง
- **แก้แล้ว:** `liff-slip.html` + `shrimpLiffSlip` function · บิลค้างแนบลิงก์ LIFF · help เมนู A/B/C · provision `shrimp-liff-slip-id.json`
- **ไฟล์/จุดสำคัญ:** `LineSlipLiffApp.jsx`, `shrimpLiffSlip.js`, `shrimpLinePush.js`, `docs/LINE_RICH_MENU_TH.md`
- **พฤติกรรมหลังแก้:** กดเมนู B → เลือกรูปสลิป → คิว `paymentSlipSubmissions` เหมือนส่งในแชต
- **ถ้าพังอีก ให้เช็กก่อน:** Rich Menu B ชี้ `liff.line.me/<LIFF_SLIP_ID>` · deploy **hosting + functions** · Secrets `LINE_LIFF_SLIP_ID`

### 2026-06-04 — กุ้ง: ข้อความช่วยเหลือ LINE สั้นลง (PR #167)

- **ปัญหา/คำขอ:** ข้อความบอทยาว · เมนูสั่งกุ้ง → สั่งออเดอร์ · แจ้งคีย์ยกเลิก
- **แก้แล้ว:** `helpCustomerTh/En` สั้นลง · รับ `วิธีสั่งซื้อ` / `สอบถาม` จาก Rich Menu
- **ถ้าพังอีก ให้เช็กก่อน:** deploy **functions** (webhook-core)

### 2026-06-04 — กุ้ง: ลูกหนี้รวม (AR) แสดง ฿0 ทั้งที่มีบิลค้าง (PR #166)

- **ปัญหา/คำขอ:** แท็บลูกหนี้ — การ์ด「ลูกหนี้รวม」เป็น ฿0 / รายลูกค้ายอด ฿0 ทั้งที่มีบิลค้างใน sales
- **แก้แล้ว:** `buildDebtCustomerRows` รวม `customerDebts` + บิล `remainingAmount > 0` · ยอดรวม AR จากแถวเดียวกับรายการ · แถวลูกค้า fallback `row.totalDebt` เมื่อยังไม่ขยาย FIFO
- **ไฟล์/จุดสำคัญ:** `debtCustomerKey.js`, `CustomerAccountsScreen.jsx`, smoke `debtCustomerRows`
- **พฤติกรรมหลังแก้:** มีบิลค้างแต่เอกสารหนี้ยังไม่อัปเดต → AR รวมและรายชื่อไม่เป็น 0
- **ถ้าพังอีก ให้เช็กก่อน:** `fsQueryOpenSales` · `incrementCustomerDebt` · `reconcileDebtsFromSales`

### 2026-06-03 — กุ้ง: รับเข้าแยกไซซ์ A/B/C ใส่ราคา/กก. ต่อไซซ์ (branch cursor/stock-receive-size-price-bf33)

- **ปัญหา/คำขอ:** รับเข้าแยกไซซ์ — ราคา A/B/C ไม่เท่ากัน ใส่ราคารวม/กก. เดียวไม่ได้
- **แก้แล้ว:** โหมด「แยก A / B / C」มีช่อง ฿/กก. + ยอดบรรทัด · ต้นทุนทั้งหมด = ซื้อกุ้งรวม + ค่ารถ · ล็อตเก็บ `sizeBreakdown` + weighted `costPerKg`
- **ไฟล์/จุดสำคัญ:** `stockReceiveCost.js`, `InventoryScreen.jsx`, `stockService.js`, `StockLotTimeline.jsx`
- **พฤติกรรมหลังแก้:** 15×850 + 20×650 + ค่ารถ 1000 → ต้นทุนรวม 26,750 · โหมดรวมไซซ์ยังใช้ราคา/กก. เดิม
- **ถ้าพังอีก ให้เช็กก่อน:** `missingSizePriceLabel` · smoke `stockReceiveCost`

### 2026-06-03 — ชา: ติ๊กมาทำงานอัตโนมัติจากยอดขาย · ลูกน้องติ๊กมือไม่ได้ (PR #153)

- **ปัญหา/คำขอ:** แท็บตัดวัน — ระบบติ๊กมาทำงานเมื่อบันทึกขายครั้งแรกของวัน · ลูกน้องห้ามติ๊กเอง (กันมาวันที่ไม่ได้มาทำงาน)
- **แก้แล้ว:** `ensurePrimaryStaffPresentOnSale` หลัง `saveTeaOrder` · `markedBy: ระบบ (ยอดขายแรกของวัน)` · ติ๊กมือต้อง `actingMember.role === admin` · แท็บตัดวันแสดงเฉพาะแอดมิน (`App.jsx`)
- **ไฟล์/จุดสำคัญ:** `orderService.js`, `staffAttendanceService.js`, `PayrollTab.jsx`, `firestore.rules`
- **พฤติกรรมหลังแก้:** ขายครั้งแรกของวัน → ติ๊กพนักงานหลักอัตโนมัติ · ลูกน้องไม่เห็นแท็บตัดวัน · แอดมินติ๊ก/ยกเลิกมือได้
- **ถ้าพังอีก ให้เช็กก่อน:** deploy **rules + hosting** · `dailyStaffAttendance.markedSource == sale`

### 2026-06-03 — แชร์บิล LINE: เลขบัญชีในข้อความ (ไม่บอกแค่ดูในภาพ)

- **ปัญหา/คำขอ (รอบ 2026-06):** ข้อความโอนใน LINE กระจุก — ต้องการแยกบรรทัด บัญชีแม่ / พีช / พร้อมเพย์ ไม่ใช้ `<tel:…>`
- **แก้:** `shrimpLinePush.js` → `buildLineBillTransferAccountsText()` จัดบรรทัด · deploy **functions** (`webhook-core`)
- **ปัญหา/คำขอ:** ลูกค้ามองเลขบัญชีบนภาพบิลยาก — ต้องการเลข KBank + พร้อมเพย์ในข้อความแชทตอนส่งบิลค้างชำระ
- **แก้แล้ว:** `lineBillUnpaidHint` ใน `shrimpLinePush.js` ต่อท้ายบรรทัดโอน (รองรับ `<tel:…|…>` แตะคัดลอก)
- **ไฟล์/จุดสำคัญ:** `apps/webhook-core/src/shrimpLinePush.js` · `scripts/test-shrimp-line-bill-caption.js`
- **พฤติกรรมหลังแก้:** บิลค้างชำระ → ข้อความ LINE มียอด + บัญชี 2 เลข + PromptPay 094-940-8665
- **ถ้าพังอีก ให้เช็กก่อน:** deploy `deploy-functions.yml` (webhook-core) · บัญชีบนภาพบิล = `billTemplateConfig.js`

### 2026-06-03 — ผูกไอดีลูกค้า: รอแอดมิน + ตาจุ้ยสองร้าน (PR #151)

- **ปัญหา/คำขอ:** ลูกค้าพิมพ์แค่「ผูกไอดีลูกค้า」ไม่ต้องสั่ง · แอดมินจับคู่เอง · ตาจุ้ยหนึ่ง UID ผูกสองร้าน
- **แก้แล้ว:** บันทึก `pendingLinkByUid` → ขึ้นรอผูกทันที · ปุ่ม「ผูกทั้งตาจุ้ยหนึ่ง+สอง」· ยังผูกทีละร้านได้
- **ไฟล์/จุดสำคัญ:** `shrimpLinePendingLink.js`, `lineOaCustomerService.js`, `lineOaLinkGroups.js`, `LineOaCustomersPanel.jsx`
- **พฤติกรรมหลังแก้:** ลูกค้า OA → `ผูกไอดีลูกค้า` → รอ · Peach → รอผูก → จับคู่ / ผูกทั้งสองตาจุ้ย
- **ถ้าพังอีก ให้เช็กก่อน:** `config/shrimpLine.pendingLinkByUid` · deploy **hosting + functions**

### 2026-06-03 — ดึง Group ID + คำสั่ง「ผูกไอดีลูกค้า」LINE OA

- **ปัญหา/คำขอ:** ดึง Group ID กลุ่มครอบครัวในแอดมิน · ลูกค้าเก่าผูก UID ผ่านบอท
- **แก้แล้ว:** ปุ่มดึง Group/User ID ในแจ้งเตือน LINE · บอทกุ้ง log `line_messages` · คำสั่ง `ผูกไอดีลูกค้า` (แชตตรง OA)
- **ไฟล์/จุดสำคัญ:** `ShrimpLineNotifySettings.jsx`, `lineIds.js`, `shrimpLineCustomerLink.js`, `index.js` (webhook)
- **พฤติกรรมหลังแก้:** พิมพ์ในกลุ่มที่มีบอท → กดดึง Group ID · ลูกค้า: `ผูกไอดีลูกค้า` (รอแอดมิน) หรือ `ผูกไอดีลูกค้า ชื่อร้าน` (อัตโนมัติ)
- **ถ้าพังอีก ให้เช็กก่อน:** deploy **hosting + functions** · ต้องมีข้อความในกลุ่มก่อนดึง ID

### 2026-06-03 — สมาชิกแอปมี LINE UID (ไม่ขึ้นรอผูก)

- **ปัญหา/คำขอ:** น้องทดสอบบอท OA ขึ้น「รอผูก」หมด · อยากให้สมาชิก `shrimp_users` มี UID ของใครของมัน
- **แก้แล้ว:** ฟิลด์ `shrimp_users.lineUserId` · แอดมินบันทึกใน「จัดการสมาชิก」หรือ「รอผูก」→ สมาชิกแอป · กรองรอผูก + บอทไม่ auto-ผูกร้าน
- **ไฟล์/จุดสำคัญ:** `shrimpMemberLineService.js`, `AdminUsersScreen.jsx`, `LineOaCustomersPanel.jsx`, `shrimpStaffLineUids.js`, `saveShrimpLineOrders.js`
- **พฤติกรรมหลังแก้:** UID ในโปรไฟล์สมาชิก = ภายใน · ลูกค้าร้านจริงยังผูกตามเดิม
- **ถ้าพังอีก ให้เช็กก่อน:** `shrimp_users.lineUserId` · deploy **hosting + functions**

### 2026-06-03 — LINE รอผูก: ซ่อนรายการทดสอบ + ผูก billing/order (PR รอบนี้)

- **ปัญหา/คำขอ:** ทดสอบบอท/LINE OA แล้ว UID ขึ้น「รอผูก」ลบไม่ได้ · ผูกหลายคนในครอบครัวทับเจ้าของ/โอน
- **แก้แล้ว:** ปุ่ม「ซ่อนรายการนี้」→ `config/shrimpLine.dismissedLineOaUids` · ผูกร้านที่มีเจ้าของแล้วถาม「คนสั่งใน LINE」vs「เจ้าของ/โอนใหม่」· `linkLineOaUidToCustomer`
- **ไฟล์/จุดสำคัญ:** `LineOaCustomersPanel.jsx`, `lineOaCustomerService.js`, `customerService.js`, `lineCustomerContacts.js`
- **พฤติกรรมหลังแก้:** แท็บรอผูก = แชท OA ตรงเท่านั้น (เดิม) · ซ่อนไม่ลบออเดอร์ · ผูก auto = order ถ้ามี billing แล้ว
- **ถ้าพังอีก ให้เช็กก่อน:** Firestore `dismissedLineOaUids` · deploy **hosting** เท่านั้น

### 2026-06-03 — คู่มือเอเจนต์ + แนวคุย Peach (docs)

- **ปัญหา/คำขอ:** Peach สั่งงานภาษาพูด · อยากให้เอเจนต์รู้โครงสร้างและรอบก่อนแก้อะไร
- **แก้แล้ว:** เพิ่ม `docs/AGENT_HANDBOOK_TH.md`, `docs/PEACH_WORKING_STYLE_TH.md`, `docs/AGENT_CHANGELOG_TH.md` (ไฟล์นี้) · อัปเดต `AGENTS.md`, skill `peter-ser`
- **ไฟล์/จุดสำคัญ:** `docs/*`, `.cursor/skills/peter-ser/SKILL.md`
- **พฤติกรรมหลังแก้:** เอเจนต์ทบทวนกับ Peach ก่อน PR ใหญ่ · อัปเดต ARCHITECTURE เมื่อเปลี่ยน Firestore
- **ถ้าพังอีก ให้เช็กก่อน:** ไม่เกี่ยว runtime — เป็นเอกสารเท่านั้น

### 2026-06-03 — เวลา「ไม่ระบุวันส่ง」LINE ตั้งในแอป (PR #148 merged)

- **ปัญหา/คำขอ:** ตั้งกติกาเวลาวันส่งเมื่อลูกค้าไม่พิมพ์วัน · ไม่ปิดรับออเดอร์
- **แก้แล้ว:** `config/shrimpLine` ฟิลด์ `lineDefaultStartHour` / `lineDefaultEndHour` (ค่าเริ่มต้น 18 / 15) · UI แอดมิน · webhook อ่าน config
- **ไฟล์/จุดสำคัญ:** `apps/webhook-core/src/shrimpLineConfig.js`, `parseDeliveryDate.js`, `apps/seafood-pos/.../ShrimpLineNotifySettings.jsx`, `lineOrderDate.js`
- **พฤติกรรมหลังแก้:** 18:00 เมื่อวาน – 15:00 วันนี้ → ส่งวันนี้ · หลัง 15:00 → พรุ่งนี้
- **ถ้าพังอีก ให้เช็กก่อน:** ค่าใน Firestore `config/shrimpLine` · deploy **functions** หลัง merge

### 2026-06-03 — LINE หลาย UID ต่อร้าน (billing / order) — PR รอบนี้

- **ปัญหา/คำขอ:** ร้านเดียวหลายคนสั่ง LINE · ส่งบิลเฉพาะคนโอน/เจ้าของ · คนสั่งอื่นเพิ่มอัตโนมัติ · เจ้าของ 2 ร้าน = 2 แถวรายชื่อ
- **แก้แล้ว:** `customers.lineContacts[]` (`billing` | `order`) · UI รายชื่อลูกค้า · ส่งบิลใช้ billing เท่านั้น · webhook ผูก order เมื่อมี billing แล้ว
- **ไฟล์/จุดสำคัญ:** `lineCustomerContacts.js`, `LineUidFields.jsx`, `customerService.js`, `resolveLineUserId.js`, `shrimpLinePush.js`
- **พฤติกรรมหลังแก้:** ช่อง「เจ้าของ/โอน」= billing · 「คนสั่งใน LINE」= order (คั่น comma) · สั่ง LINE ครั้งแรกหลังมี billing → UID ใหม่เป็น order อัตโนมัติ
- **ถ้าพังอีก ให้เช็กก่อน:** `lineContacts` ใน Firestore · deploy **hosting + functions** · billing ซ้ำข้ามร้านหลัก c1–c27 ได้

### 2026-06-11 — ชา: โครง POS + Mini ERP 4 แท็บ + history staff log

- **ปัญหา/คำขอ:** จัดโครงสร้าง `chincha-tea` ใหม่ให้เป็น POS + Mini ERP รองรับขายรายแก้ว, กรอกยอดเหมาปิดวัน, สต๊อกแก้ว, และผูกพนักงานผู้บันทึกเพื่อคิดค่าแรง/ตรวจย้อนหลัง
- **แก้แล้ว:** แท็บหลักเหลือ 4 แท็บล่าง `ขาย / หลังร้าน / บัญชี / จัดการ`; หลังร้านรวมสั่งของ + สต๊อกแก้ว; บัญชีรวมปิดวัน + จ่ายย่อย; จัดการรวมภาพรวม/สินค้า/กำไร/ค่าแรง/ประวัติ
- **ข้อมูล:** เพิ่ม `historyLogs` สำหรับ audit action สำคัญ และเพิ่ม `staffUid/staffName` snapshot ใน `teaOrders`, `dailyExpenses`, `dailyCupStocks`, `restocks`; ปิดวันเพิ่ม `cashChangeRemaining`
- **ไฟล์/จุดสำคัญ:** `App.jsx`, `navConfig.js`, `OpsTab.jsx`, `SummaryTab.jsx`, `ExpensesTab.jsx`, `historyLogService.js`, `firestore.rules`
- **ถ้าพังอีก ให้เช็กก่อน:** deploy hosting + rules; ตรวจสิทธิ `historyLogs.create` ต้อง `staffUid == request.auth.uid`

### 2026-06-11 — ชา: แยก flow พนักงานปิดวัน + สต๊อกแก้ว

- **ปัญหา/คำขอ:** ลูกน้องต้องมี 3 งานหลัก: ขายรายแก้ว, กรอกสรุปเหมาเงินสด/โอน/แก้ว/เงินที่จ่ายจากร้าน, และแจ้งเติมแก้ว/คงเหลือไว้เช็กยอดขายกับแก้วจริง
- **แก้แล้ว:** `บัญชี > สรุปวัน` มีช่อง `จ่ายจากเงินร้าน` กลับมาในฟอร์มสรุปเหมาและถูกหักในยอดหลังจ่าย; `หลังร้าน` เหลือ `สั่งของ` + `สต๊อกแก้ว` ไม่เอา `จ่ายย่อย` ไปคั่น flow พนักงาน
- **ข้อมูล:** `dailyExpenses` เอกสาร `type: dailySummary` เก็บ `storefrontExpense` และ `amount` เท่ากับเงินที่จ่ายจากร้าน เพื่อให้กำไร/สรุป LINE นับเป็นค่าใช้จ่ายร้าน
- **ไฟล์/จุดสำคัญ:** `OpsTab.jsx`, `SummaryTab.jsx`, `ExpensesTab.jsx`, `i18n.js`
- **พฤติกรรมหลังแก้:** พนักงานใช้ `ขาย` → `บัญชี > สรุปวัน` → `หลังร้าน > สต๊อกแก้ว`; เจ้าของยังดูซื้อของ/กำไรจากข้อมูลชุดเดิม
- **ถ้าพังอีก ให้เช็กก่อน:** `saveDailySummaryExpense` ต้องไม่ reset `storefrontExpense` เป็น 0 และ `OpsTab` ต้องไม่มี tab `expenses`
