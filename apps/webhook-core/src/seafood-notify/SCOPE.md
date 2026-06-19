# seafood-notify — แจ้งเตือน + บิลกุ้ง

## Cloud Function Entry Points
- `onShrimpLineOrderCreated` — Firestore trigger: lineOrders → push แจ้ง group/admin
- `onShrimpPaymentSlipCreated` — Firestore trigger: paymentSlipSubmissions → push แจ้ง
- `onShrimpAdminAlertCreated` — Firestore trigger: shrimpAdminAlerts → push แจ้ง
- `shrimpPushBill` — HTTP: พนักงานส่งรูปบิลให้ลูกค้าทาง LINE (Bearer auth)
- `shrimpRenderBill` — HTTP: render รูปบิล Satori บน Cloud
- `shrimpPreRenderBill` — HTTP: pre-render บิลเก็บ cache

## บทบาท
**Outbound เท่านั้น** — ไม่รับ LINE webhook จากลูกค้า
- Push แจ้งเตือนเข้ากลุ่ม LINE เมื่อมีออเดอร์/สลิปใหม่
- ส่งรูปบิลให้ลูกค้าตาม LINE UID
- Render ภาพบิล (Satori → JPEG/PNG)

## Personality
- ไม่มี — ไม่ตอบกลับ ส่งแจ้งเตือนอย่างเดียว
- ข้อความสั้น มีแอ็กชัน เช่น "🦐 ออเดอร์ LINE ใหม่" + ข้อมูลลูกค้า

## Environment Variables
- `LINE_CHANNEL_ACCESS_TOKEN` — ส่ง push message เข้ากลุ่ม/ลูกค้า OA กุ้ง
- `LINE_TEA_CHANNEL_ACCESS_TOKEN` — push แจ้งเตือน restock ชา

## ไฟล์หลัก
- `instantLineNotify.js` — logic แจ้งเตือนออเดอร์/สลิป/restock
- `shrimpLinePush.js` — push รูปบิลให้ลูกค้า + customer lookup
- `shrimpBillRender.js` — render บิลเป็นรูปภาพ (Satori)
- `shrimpBillPreRender.js` — pre-render + cache บิล
- `shrimpBillTemplateRows.js` — template rows สำหรับ render

## ถ้าพัง
เช็ก `instantLineNotify.js` (linePush จาก `../shared/lineUtils`) → `shrimpLineConfig.js` (ใน seafood-oa)
สำหรับบิล: `shrimpLinePush.js` → `shrimpBillPreRender.js` → `shrimpBillRender.js`
