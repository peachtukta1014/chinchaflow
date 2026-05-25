# เปิด Cloud Scheduler API (ครั้งเดียว)

ถ้า GitHub Actions ขึ้น **Permissions denied enabling cloudscheduler.googleapis.com** ให้เจ้าของโปรเจกต์เปิด API ด้วยมือ:

1. เปิดลิงก์ (โปรเจกต์ `chincha-eeed6`):  
   https://console.cloud.google.com/apis/library/cloudscheduler.googleapis.com?project=chincha-eeed6  
2. กด **Enable** / **เปิดใช้งาน**
3. กลับ GitHub → Actions → **Deploy Cloud Functions** → **Re-run failed jobs**

หลังเปิดแล้ว job **Deploy scheduled tea summary** จะ deploy ฟังก์ชันส่งสรุปอัตโนมัติตอนกลางคืนได้

ถ้ายังไม่เปิด Scheduler: LINE webhook ชา/กุ้ง และปุ่มส่งสรุปจากแอปยังใช้ได้ — แค่ไม่มี push อัตโนมัติตามเวลา
