# shared — ยูทิลิตี้กลาง

## บทบาท
ไฟล์ที่ใช้ร่วมกันระหว่างทุก scope (seafood-oa, seafood-notify, tea)
ห้ามมี business logic เฉพาะ scope ใด scope หนึ่ง

## ไฟล์
- `lineUtils.js` — `todayBKK`, `lineReply`, `linePush`, `formatMoney`
  - **สำคัญ**: เป็น single source of truth ของการส่ง LINE API
  - เหตุที่แยกออกมา: เดิม seafood files import จาก `teaDailySummary.js` ทำให้แก้ชาแล้วกระทบกุ้ง
- `webhookDedup.js` — dedup LINE webhook events ผ่าน Firestore
  - ใช้ใน `lineWebhook` (กุ้ง) และ `lineWebhookTea` (ชา)
