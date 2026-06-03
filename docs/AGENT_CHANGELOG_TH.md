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
