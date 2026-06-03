# CHINCHA FLOW — ชื่อระบบและคำเรียกสากล

เอกสารอ้างอิงเดียวสำหรับชื่อภาพรวม ทีม dev และเอเจนต์ — อัปเดตเมื่อเปลี่ยนแบรนด์หรือโครงสร้างหลัก

## ชื่อที่ใช้ตรงกันทั้งระบบ

| ชื่อ | ประเภท | ใช้เมื่อไหร่ |
|------|--------|-------------|
| **CHINCHA FLOW** | ชื่อผลิตภัณฑ์ / ภาพรวมธุรกิจ | พูดกับทีม, เครดิตในแอป, Slack `#chincha-flow`, เอกสารภาพรวม |
| **chincha-business-os** | ชื่อ monorepo (เทคนิค) | `package.json`, GitHub repo folder, สถาปัตยกรรม, CI/CD |
| **chincha-eeed6** | Firebase project ID | Auth, Firestore, Hosting, Functions, Storage |
| **พี่เซอ · Cursor Cloud Agent** | สายพัฒนา | งาน dev ผ่าน Cursor — ไม่ใช่ user login ในแอป |

**กฎสั้น:** เรียกระบบรวมว่า **CHINCHA FLOW** · เรียก repo ว่า **chincha-business-os** · อย่าสลับสองคำนี้ในที่เดียวกันโดยไม่จำเป็น

## สมาชิกใน CHINCHA FLOW (แอปย่อย)

| ชื่อที่แสดง | โฟลเดอร์ | URL | บทบาทหลัก |
|------------|----------|-----|-----------|
| **โกอ้วน คลังซีฟู้ด** | `apps/seafood-pos` | https://ko-seafood.top | ขาย, สต๊อก FIFO, ลูกค้า, บิล, ออเดอร์ LINE |
| **CHINCHA / ชินชา Tea POS** | `apps/chincha-tea` | https://chincha-tea.web.app | ขายร้านชา, สรุปวัน, เติมของ, แอดมิน, หลายภาษา |
| **LINE backend** | `apps/webhook-core` | Cloud Functions `asia-southeast1` | Webhook, ส่งบิล, สรุปยอด, LIFF — ไม่มีหน้าเว็บพนักงาน |

ทั้งสามอยู่บน **Firebase โปรเจกต์เดียว** แยก collection / Hosting target ตามธุรกิจ

---

## ระบบนี้เรียกแบบสากลว่าอะไร? (ไม่ใช่แค่ POS)

**POS (Point of Sale)** = เฉพาะชั้น **รับออเดอร์/รับเงินหน้าร้าน** (แท็บขาย, ตะกร้า, บิล)

CHINCHA FLOW กว้างกว่า POS มาก ในภาษาสากลมักจัดกลุ่มแบบนี้:

| ชั้น (อังกฤษ) | ความหมาย | มีในระบบเรา |
|---------------|----------|-------------|
| **POS** | จุดขาย / บันทึกยอดหน้าร้าน | ชา + กุ้ง |
| **Inventory / WMS** | สต๊อก, ล็อต FIFO, รับเข้า | กุ้ง (หลัก), ชา (เติมของ) |
| **CRM** | รายชื่อลูกค้า, LINE UID, บทบาท billing/order | กุ้ง |
| **OMS** (Order Management) | ออเดอร์จาก LINE, จัดส่ง, สถานะ | กุ้ง + webhook |
| **Back-office / Admin** | สมาชิกแอป, ตั้งค่าราคา, สรุปกำไร, รายจ่าย | ทั้งสองแอป (ตาม role) |
| **Integration layer** | LINE Messaging API, LIFF, push บิล | webhook-core |

### คำเรียกภาพรวมที่ตรงที่สุด

1. **Business Operations Platform (BOP)** — แพลตฟอร์มปฏิบัติการธุรกิจ (ชื่อ repo `chincha-business-os` มาจากแนวนี้)
2. **Retail & wholesale operations system** — ระบบปฏิบัติการค้าปลีก/ส่ง (กุ้งเน้นส่ง + ค้างชำระ)
3. **Vertical operations stack** — สแต็กเฉพาะทาง F&B / อาหารทะเล (ไม่ใช่ POS สำเร็จรูปทั่วไป)

**สรุปให้พีช:** พูดกับคนนอกได้ว่า  
*“We run **CHINCHA FLOW** — a **business operations platform** on Firebase: POS plus inventory, customers, and LINE order automation for our tea shop and seafood warehouse.”*  

ถ้าคนถามสั้นๆ ว่า POS ไหม → ตอบ: **มี POS เป็นส่วนหนึ่ง แต่ทั้งระบบคือแพลตฟอร์มบริหารร้านแบบครบวงจร ไม่ใช่แค่เครื่องคิดเงิน**

---

## แผนภาพชื่อ (อ้างอิงเร็ว)

```
CHINCHA FLOW                    ← ชื่อระบบ / แบรนด์ (ที่พีชเป็นเจ้าของ & ออกแบบ)
└── chincha-business-os (repo)  ← โค้ดรวม
    └── Firebase chincha-eeed6
        ├── ชินชา Tea POS
        ├── โกอ้วน คลังซีฟู้ด
        └── LINE · webhook-core
```

---

## เอกสารที่อ้างชื่อนี้

- [README.md](../README.md) — หน้าแรก repo
- [ARCHITECTURE_TH.md](./ARCHITECTURE_TH.md) — สถาปัตยกรรม
- [AGENT_HANDBOOK_TH.md](./AGENT_HANDBOOK_TH.md) — แผนที่เอเจนต์
- `packages/app-credits` — เครดิตในแอป (`studioLabel: CHINCHA FLOW`)
