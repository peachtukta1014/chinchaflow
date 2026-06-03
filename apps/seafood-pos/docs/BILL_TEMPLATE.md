# บิลดิจิทัล (React)

แอปสร้าง **ใบส่งของ** จากคอมโพเนนต์ `BillTemplate.jsx` แล้วแปลงเป็นภาพ JPEG ด้วย `html2canvas` — **ไม่ใช้ภาพสแกนบิล** อีกต่อไป

## แถวสินค้าคงที่บนฟอร์ม

- หัวข้อกุ้งเป็น / กุ้งตาย + แถวไซซ์ โหญ่·กลาง·เล็ก — **พิมพ์ชื่อแถวครบทุกบรรทัด** แม้ยังไม่มียอด (คอลัมน์จำนวน/ราคาว่าง)
- รายการ `productId: custom` และหมวดอื่นๆ → `extraLines` ใน 5 แถวใต้กุ้งตาย — **ว่างจนกว่าจะมีข้อมูลจริง**
- ความสูงแถวข้อมูลในตารางเท่ากันทุกแถว (`h-9`)
- คอลัมน์จำนวนแสดงหน่วย `Kg` เมื่อมีน้ำหนัก
- กำหนดแถวใน `src/lib/billTemplateRows.js`

## ไฟล์หลัก

- `src/components/BillTemplate.jsx` — หน้าตาบิล
- `src/lib/billTemplateRows.js` — แถวคงที่ + ชื่อแมป
- `/logo.jpg` — โลโก้แบรนด์ (หัวบิล + แทนไอคอนโน้ตบรรทัดภูเก็ต)
- `src/lib/billDataFromSale.js` — แปลงบิลจาก POS → ข้อมูลฟอร์ม
- `src/lib/generateBillImage.js` — render + ส่งออก JPEG
- `public/bill-assets/line-oa-qr.png` — QR LINE

## ยอดเงิน

ไม่หักส่วนลดสมาชิก — `totalAmount` = ยอดขายจริง

## แก้ layout

แก้ใน `BillTemplate.jsx` (Tailwind) แล้ว build + deploy
