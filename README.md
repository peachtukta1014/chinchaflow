# chincha-business-os

Monorepo สำหรับระบบธุรกิจ Chincha

## Apps
- `apps/seafood-pos` — POS กุ้ง
- `apps/chincha-tea` — ร้านชา
- `apps/webhook-core` — LINE Webhook

## Deploy
Auto deploy ไป Firebase Hosting เมื่อ push to main

### เคลียร์ข้อมูลร้านชา (Firestore)
ถ้าบันทึกในแอพแล้วไม่ขึ้น มักเพราะข้อมูลเก่าค้างใน DB ชื่อ `chincha` หรือเมนู/ออเดอร์รูปแบบเก่า — ใช้สคริปต์นี้ (ลบเฉพาะร้านชา ไม่แตะกุ้ง):

```bash
firebase login
gcloud auth application-default login --project chincha-eeed6

npm install
npm run tea:db-reset:dry          # ดูก่อน
npm run tea:db-reset:all          # ลบ (default) + chincha DB + seed เมนู
firebase deploy --only firestore:rules,firestore:indexes,functions,hosting:tea
```

เก็บ `users` และ `config` ไว้ — หลังเคลียร์ต้องมี `users/{uid}` ที่ `approved: true`
