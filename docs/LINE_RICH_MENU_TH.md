# Rich Menu กุ้ง (แถบล่างแชต LINE OA)

ตั้งใน [LINE Official Account Manager](https://manager.line.biz/) → ริชเมนู → **สร้างใหม่** → ตั้งเป็น **เมนูหลัก (Default)**

## แนะนำ: 3 ช่อง · Large (2500×843)

| ช่อง | ป้ายไทย | ป้าย EN (บนภาพเล็ก) | Action |
|------|---------|---------------------|--------|
| A | **สั่งออเดอร์** | Order | เปิด URL `https://liff.line.me/<LIFF_ORDER_ID>` |
| B | **ฝากสลิปยืนยันการโอน** | Upload slip | เปิด URL `https://liff.line.me/<LIFF_SLIP_ID>` |
| C | **Help** | Help | ส่งข้อความ `วิธีสั่งซื้อ` หรือ `ช่วยเหลือ` |

### LIFF ID

| หน้า | Endpoint hosting | ไฟล์ config (หลัง provision CI) |
|------|------------------|--------------------------------|
| สั่งออเดอร์ | `https://ko-seafood.top/liff-order.html` | `apps/webhook-core/shrimp-liff-id.json` |
| ฝากสลิป | `https://ko-seafood.top/liff-slip.html` | `apps/webhook-core/shrimp-liff-slip-id.json` |

Provision มือ:

```bash
LINE_CHANNEL_ACCESS_TOKEN=xxx node apps/webhook-core/scripts/provision-shrimp-liff.mjs --ensure
LINE_CHANNEL_ACCESS_TOKEN=xxx node apps/webhook-core/scripts/provision-shrimp-liff.mjs --ensure --slip
```

### ทำไม 3 ช่องแบบนี้

- **A สั่ง** — ฟอร์ม LIFF (ลูกค้าใหม่/เก่า)
- **B ฝากสลิป** — หน้าเต็มจอเลือกรูป (เหมาะลูกค้าอายุมาก ไม่ต้องหา 📎 ในแชต)
- **C Help** — คู่มือสั้น + วิธียกเลิก

## บิลค้างชำระ (แชท LINE)

เมื่อร้านส่งภาพบิลค้าง ข้อความแนบจะมีลิงก์ LIFF ฝากสลิป (พร้อมเลขบิลใน URL ถ้ามี)

## ภาพพื้นหลัง (ง่ายๆ)

- สีเข้มเดียว + ไอคอนขาว 3 อัน · ป้าย A/B/C อ่านง่าย
- ขนาดตาม LINE Manager (มัก 2500×843 px)

## ฟอร์ม LIFF สั่ง (หลังกด A)

1. เลือกกุ้ง + วันส่ง  
2. **คุณเคยสั่งกับทางเราไหม** → เคยแล้ว (เลือกชื่อร้าน) / ยังไม่เคย (กรอกข้อมูล)  
3. ยืนยันส่ง  

## ฝากสลิป (หลังกด B)

1. กด「เลือกรูปสลิป / ถ่ายรูป」  
2. กด「ส่งสลิปให้ร้าน」  
3. ร้านตรวจในแอปกุ้ง → แท็บสลิปรอตรวจ  

ยังส่งรูปในแชตตรงๆ ได้เหมือนเดิม
