# seafood-oa — LINE OA กุ้ง + กลุ่มครอบครัว

## Cloud Function Entry Point
`lineWebhook` (index.js) → `shrimpLineWebhookRouter.js`

## บทบาท
รับและตอบกลับข้อความจาก LINE OA ของร้านกุ้ง (โกอ้วน คลังซีฟู้ด)
- **Direct / 1:1** (ลูกค้าแชทหาโอเอ): รับออเดอร์ สรุปคำสั่ง ส่งฟอร์ม LIFF
- **Group chat** (กลุ่มครอบครัว/พนักงาน): รับออเดอร์ ดูสรุปวันนี้

## Personality
- ชื่อบอท: **โกอ้วน คลังซีฟู้ด** 🦐
- ลักษณะ: เป็นกันเอง ตรงไปตรงมา รับออเดอร์กุ้งเป็นหลัก
- ไม่ตอบคำถามทั่วไป — focus เฉพาะออเดอร์กุ้ง

## คำสั่ง (LINE OA 1:1 — ลูกค้า)
| คีย์ / ข้อความ | Intent | การตอบ |
|---|---|---|
| สั่งกุ้ง N กก | `order` | ยืนยันออเดอร์ + ถามวันส่ง |
| ฟอร์ม / form / liff | `open_liff` | ส่ง Flex message เปิดฟอร์ม LIFF |
| ยกเลิก / cancel | `cancel_order` | ยกเลิกออเดอร์ล่าสุดที่ pending |
| help / ช่วยเหลือ | `help` | เมนูคำสั่งภาษาไทย |
| 2 / en / english | `help_en` | เมนูคำสั่งภาษาอังกฤษ |
| ผูก [ชื่อลูกค้า] | `link_customer` | ผูก LINE UID กับรายชื่อลูกค้า |
| ส่งรูปสลิป | image | บันทึกสลิปการโอนเงิน |
| follow event | — | ส่งข้อความต้อนรับ + ลิงก์ฟอร์ม |

## คำสั่ง (Group chat — กลุ่มครอบครัว)
| คีย์ / ข้อความ | Intent | การตอบ |
|---|---|---|
| สั่งกุ้ง N กก | `order` | บันทึกออเดอร์ + ตอบยืนยัน |
| สรุป / สรุปวันนี้ | `summary` | สรุปยอดออเดอร์วันนี้ |
| ออเดอร์วันนี้ | `today_orders` | รายการออเดอร์ที่ต้องจัดส่งวันนี้ |
| ส่งรูปสลิป | image | บันทึกสลิป (เฉพาะกลุ่มครอบครัว) |
| ข้อความอื่น | ignore | ไม่ตอบ (ลดการรบกวนแชทกลุ่ม) |

## Environment Variables
- `LINE_CHANNEL_SECRET` — verify signature webhook กุ้ง
- `LINE_CHANNEL_ACCESS_TOKEN` — ส่งข้อความกลับทาง LINE OA กุ้ง
- `LINE_LIFF_ID` — LIFF สั่งออเดอร์
- `LINE_LIFF_SLIP_ID` — LIFF ฝากสลิป

## ไฟล์หลัก
- `shrimpLineWebhookRouter.js` — แยก direct vs group
- `shrimpDirectLineWebhook.js` — handler แชท 1:1
- `shrimpGroupLineWebhook.js` — handler แชทกลุ่ม
- `shrimpLineIntent.js` — จำแนก intent จากข้อความ
- `shrimpLineOrderHandler.js` — ประมวลผลออเดอร์
- `shrimpLiffOrderSubmit.js` — รับ LIFF order submission

## ถ้าพัง
เช็ก `shrimpLineWebhookRouter.js` → `shrimpDirectLineWebhook.js`/`shrimpGroupLineWebhook.js` → `shrimpLineIntent.js`
