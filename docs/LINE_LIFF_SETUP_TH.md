# ตั้งค่า LIFF สั่งกุ้ง (โกอ้วน)

ใช้คู่กับ `docs/LINE_OA_ORDER_SCOPE_TH.md` — **แชทพิมพ์และกลุ่ม LINE ยังใช้ได้เหมือนเดิม** · LIFF เพิ่มช่องทาง OA ให้ส่งออเดอร์ขึ้นบอร์ดแอปโดยไม่พึ่ง parse ข้อความ

## URL โปรดักชัน

- หน้า LIFF: `https://ko-seafood.top/liff-order.html`
- Cloud Function: `https://asia-southeast1-chincha-eeed6.cloudfunctions.net/shrimpLiffOrder`

## 1) LINE Developers — สร้าง LIFF

1. เปิด Channel กุ้ง (Messaging API) → แท็บ **LIFF**
2. Add → **Full** · Endpoint URL = `https://ko-seafood.top/liff-order.html`
3. คัดลอก **LIFF ID** (ตัวเลข)

## 2) GitHub Secrets

| Secret | ใช้ที่ |
|--------|--------|
| `LINE_LIFF_ID` | Cloud Functions (`verify` id_token) |
| `VITE_LIFF_ID` | Build แอปกุ้ง (ค่าเดียวกับ LIFF ID) |

มีอยู่แล้ว: `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET`

## 3) Deploy

- Push `main` → `deploy-functions.yml` (ถ้าแก้ webhook-core)
- Push `main` → `deploy-hosting.yml` (ถ้าแก้ seafood-pos)

## 4) Rich Menu (ทีมตั้งใน LINE)

- ปุ่ม **สั่งกุ้ง** → เปิด LIFF URL ด้านบน
- ปุ่ม **แชท** → ไม่เปิดฟอร์ม (พิมพ์สั่งเอง)

## พฤติกรรมฟอร์ม

| สถานะลูกค้า | ฟอร์ม |
|-------------|--------|
| ผูก `lineUserId` แล้ว | สั้น — ชื่อจากแอป |
| ยังไม่ผูก (ลูกค้าเก่า) | **เลือกชื่อในรายชื่อ** → สั่ง · ผูก UID ให้แถวที่เลือก (ถ้าเป็น c1–c27) |
| ใหม่จริง | โปรไฟล์ + สั่ง |

หลังสั่ง: `lineOrders` ชื่อ `source: 'liff'` · ยืนยันในแชท LINE (push)

## ทดสอบในเครื่อง (ไม่มี LIFF ID)

```bash
npm run dev:seafood
# http://localhost:5173/liff-order.html
# ?mode=pick  — เลือกรายชื่อ
# ?mode=new   — ลูกค้าใหม่
```

## ผูก UID มือ (Peach)

ยังทำได้เหมือนเดิม: สมาชิก → ลูกค้า → วาง UID → บันทึก · หรือแท็บ **LINE รอผูก**
