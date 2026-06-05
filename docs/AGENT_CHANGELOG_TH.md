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
