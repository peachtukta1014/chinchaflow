# บิลดิจิทัล (React)

แอปสร้าง **ใบส่งของ** จากคอมโพเนนต์ `BillTemplate.jsx` แล้วแปลงเป็นภาพ JPEG ด้วย `html2canvas` — **ไม่ใช้ภาพสแกนบิล** อีกต่อไป

## แถวสินค้าคงที่บนฟอร์ม

| แถว | ชื่อบนบิล | แมปจากแอป |
|-----|-----------|------------|
| A | กุ้งแม่น้ำ A | กุ้งใหญ่ |
| B | กุ้งแม่น้ำ B | กุ้งกลาง |
| C | กุ้งแม่น้ำ C | กุ้งเล็ก |
| — | กุ้งแม่น้ำตาย ใหญ่ / เล็ก | กุ้งตาย |

แถวว่างใช้ใส่รายการพิเศษ (ชื่ออื่น) จาก `extraLines`

## ไฟล์หลัก

- `src/components/BillTemplate.jsx` — หน้าตาบิล
- `src/lib/billDataFromSale.js` — แปลงบิลจาก POS → ข้อมูลฟอร์ม
- `src/lib/generateBillImage.js` — render + ส่งออก JPEG
- `public/bill-assets/line-oa-qr.png` — QR LINE

## ยอดเงิน

ไม่หักส่วนลดสมาชิก — `totalAmount` = ยอดขายจริง

## แก้ layout

แก้ใน `BillTemplate.jsx` (Tailwind) แล้ว build + deploy
