# chincha-business-os

Monorepo สำหรับระบบธุรกิจ Chincha

## เอกสาร

- **[สถาปัตยกรรมระบบ (ภาษาไทย)](docs/ARCHITECTURE_TH.md)** — ภาพรวมแอป, Firestore, Cloud Functions, LINE และการ deploy
- [โครงสร้างโปรเจกต์](docs/PROJECT_STRUCTURE.md)
- [สถานะบนคลาว](docs/CLOUD_STATUS.md)

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

**ไม่มีเครื่อง local:** GitHub → Actions → **Tea DB Reset** → Run workflow  
1) dry run เปิดไว้ก่อน 2) รอบถัดไป ปิด dry run + พิมพ์ `RESET` ใน confirm_phrase

firebase deploy --only firestore:rules,firestore:indexes,functions,hosting:tea
```

เก็บ `users` และ `config` ไว้ — หลังเคลียร์ต้องมี `users/{uid}` ที่ `approved: true`
