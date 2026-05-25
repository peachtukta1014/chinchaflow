# ใช้ภาพบิลที่แสกนเป็นเทมเพลต

แอปสร้างบิลโดยวาดชื่อลูกค้า / รายการ / ยอดเงินทับบน **ภาพบิลเปล่า** แล้วแชร์ LINE ได้

## 1. เตรียมภาพแสกน

- แสกนหรือถ่าย **บิลเปล่า** (ฟอร์มเท่านั้น ไม่มีลายมือ ไม่มีรายการสินค้า ไม่มียอดรวม)
- ถ่ายตรง สว่างพอ ขอบบิลครบ
- **ไม่ต้อง** ใส่ QR LINE ในแสกน — แอปวาด QR จาก `public/bill-assets/line-oa-qr.png` ให้เอง
- บันทึกเป็น JPG หรือ PNG (HEIC จาก iPhone ใช้ได้)

## 2. ใส่ในโปรเจกต์ (สำหรับทีม / deploy)

จากโฟลเดอร์ `apps/seafood-pos`:

**สร้างทั้ง 3 จากไฟล์ตัวอย่างใน repo** (`bill-templates/bill1–3.jpg`):

```bash
node scripts/rebuild-bill-templates-from-samples.mjs
```

หรือไฟล์เดียว:

```bash
node scripts/prepare-bill-template.mjs /path/to/บิลเปล่า.jpg template-empty.jpg
```

ผลลัพธ์ใน `public/bill-assets/`:

| ไฟล์ตัวอย่าง | ในแอป | ความหมาย |
|-------------|--------|----------|
| bill1.jpg | `template-empty.jpg` | บิลเปล่า (ใช้ generate หลัก) |
| bill2.jpg | `template-credit.jpg` | ฟอร์มเครดิต (สำรอง) |
| bill3.jpg | `template-cash.jpg` | ฟอร์มสด (สำรอง) |

จากนั้น build + deploy ตามปกติ (Firebase Hosting ชุด shrimp)

## 3. หลัง deploy บนมือถือ

- เปิด https://chincha-shrimp.web.app แล้ว **รีเฟรชแรง** หรือลบ PWA แล้ว Add to Home Screen ใหม่ (กัน cache รูปเก่า)
- ทดสอบ: ขายของ → ดูภาพบิล หรือ บัญชี → เลือกบิลลูกค้า → ดูภาพบิล  
  หัวชีตควรขึ้นชื่อลูกค้าจริง ไม่ใช่ชื่อในภาพแสกนเก่า

## 4. ถ้าตัวหนังสือไม่ตรงช่อง

ตำแหน่งอ้างอิงอยู่ใน `src/lib/generateBillImage.js` (ค่า `LAYOUT`)  
ออกแบบมาสำหรับฟอร์มกว้างประมาณ **2152–2683 px** — ถ้าแสกนคนละสัดส่วนมาก อาจต้องปรับพิกัดเล็กน้อยใน `LAYOUT`

เทมเพลตล่าสุดจาก Google Drive (ใบส่งของเปล่า โกอ้วน คลังซีฟู้ด) อัปเดตผ่าน:

```bash
node scripts/prepare-bill-template.mjs /path/to/บิลเปล่า.jpg template-empty.jpg
```

## 5. บิลเครดิต / สด (แยกฟอร์ม)

ตอนนี้ระบบใช้ **เทมเพลตเปล่าเดียว** (`template-empty.jpg`) แล้วใส่ข้อความตามบิลจริง  
ถ้ามีฟอร์มเครดิต/สดคนละแบบ เก็บไฟล์แยกไว้ก่อน แล้วค่อยขยายโค้ดให้เลือกตาม `paymentType` ได้ในอนาคต
