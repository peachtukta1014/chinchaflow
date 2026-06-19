# tea — LINE บอทชา (ชินชา)

## Cloud Function Entry Points
- `lineWebhookTea` — LINE webhook ร้านชา
- `teaPushSummary` — HTTP: แอดมิน/พนักงานกดส่งสรุปจากแอป (Bearer auth)
- `onTeaRestockCreated` — Firestore trigger: restocks → push แจ้งเตือน restock

## บทบาท
บอทภายในร้าน — **ไม่รับออเดอร์ลูกค้า**
- แจ้งสรุปปิดวันผ่าน LINE กลุ่มร้านน้ำ
- ตอบคำสั่งพนักงาน/แอดมินในกลุ่ม LINE ที่ตั้งใน config

## Personality
- ชื่อบอท: **บอทแจ้งสรุป — ชินชา** 🧋
- ลักษณะ: เป็นทางการ กระชับ มีข้อมูลยอดขาย ค่าใช้จ่าย กำไร
- ไม่ตอบกลับแชทที่ไม่ใช่กลุ่มที่ตั้งใน `config/teaLine.notifyGroupId`

## คำสั่ง (กลุ่ม LINE ร้านน้ำ)
| คีย์ / ข้อความ | คำสั่ง | การตอบ |
|---|---|---|
| สรุป / สรุปวันนี้ / ปิดวัน / 1 | `summary` | สรุปยอดขาย สด/โอน แก้ว ค่าใช้จ่าย กำไร |
| ซื้อเข้าร้าน / ซื้อของ / restock / 2 | `restock` | รายการสั่งของวันนี้ + ยอดที่ซื้อแล้ว |
| help / ช่วยเหลือ / คำสั่ง / 3 | `help` | แสดงรายการคำสั่งทั้งหมด |
| ข้อความอื่น (ในกลุ่มที่ถูกต้อง) | — | บันทึกใน `line_messages` (ไม่ตอบ) |
| ทุกข้อความ (กลุ่มที่ไม่ตรง) | — | ถ้าเป็นคำสั่ง → แจ้งว่ากลุ่มผิด |

## Firestore Config
- `config/teaLine.notifyGroupId` — LINE Group ID ของกลุ่มร้านน้ำ
- `config/teaLine.notifyUserIds` — UID เพิ่มเติมที่รับ push
- `config/teaLine.autoSummaryEnabled` — เปิด/ปิดสรุปอัตโนมัติ

## Environment Variables
- `LINE_TEA_CHANNEL_SECRET` — verify signature webhook ชา
- `LINE_TEA_CHANNEL_ACCESS_TOKEN` — ส่งข้อความกลับทาง LINE OA ชา

## ไฟล์หลัก
- `teaWebhook.js` — handler webhook ชา (ดึงจาก index.js)
- `teaDailySummary.js` — สรุปยอดขาย + คำสั่ง LINE ชา

## ถ้าพัง
เช็ก `teaWebhook.js` → `teaDailySummary.js` (import shared จาก `../shared/lineUtils`)
ตรวจ `config/teaLine` ใน Firestore ว่า `notifyGroupId` ถูกต้องหรือไม่
