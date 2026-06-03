# คู่มือเอเจนต์ — โครงสร้าง repo และการอัปเดตเอกสาร

ให้ทุกรอบงาน (Cloud Agent, พี่เซอ, Cursor) เริ่มจากที่นี่ + `AGENTS.md`

## เมื่อมีปัญหา / บั๊ก (ขั้นแรก)

1. อ่าน **`docs/AGENT_CHANGELOG_TH.md`** — รอบก่อนแตะจุดไหน (เริ่มแก้จากตรงนั้น)
2. อ่าน entry ที่เกี่ยว + ไฟล์ที่ระบุ
3. ค่อยไล่โค้ด / reproduce

เมื่อ **merge งานที่เปลี่ยนพฤติกรรม** → เพิ่ม entry บนสุดใน `AGENT_CHANGELOG_TH.md` (ใน PR เดียวกัน)

## แผนที่ repo (สรุป)

```
chincha monorepo (Firebase chincha-eeed6)
├── apps/chincha-tea/      # POS ชา · chincha-tea.web.app
├── apps/seafood-pos/      # POS กุ้ง · ko-seafood.top
├── apps/webhook-core/     # LINE Cloud Functions · asia-southeast1
├── firestore.rules        # กฎ Firestore ร่วม
├── .github/workflows/     # deploy hosting / functions / rules
├── docs/                  # เอกสารทีม + สถาปัตยกรรม
└── .cursor/skills/        # land-it, peter-ser, ship-*, deploy-*
```

รายละเอียดเชิงลึก:

| เอกสาร | ใช้เมื่อไหร่ |
|--------|-------------|
| [ARCHITECTURE_TH.md](./ARCHITECTURE_TH.md) | ภาพรวมระบบ, Firestore collections, deploy |
| [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) | โฟลเดอร์/ไฟล์สำคัญแต่ละแอป |
| [LINE_OA_ORDER_SCOPE_TH.md](./LINE_OA_ORDER_SCOPE_TH.md) | ขอบเขต LINE OA กุ้ง, LIFF, Rich Menu |
| [PEACH_WORKING_STYLE_TH.md](./PEACH_WORKING_STYLE_TH.md) | วิธีคุยกับ Peach, ทบทวนก่อนลงมือ |
| `AGENTS.md` | กฎ monorepo, smoke, อย่าเพิ่ม CI ซ้ำ |
| `apps/seafood-pos/AGENTS.md` | ขอบเขตงานกุ้ง |
| `apps/chincha-tea/AGENTS.md` | ขอบเขตงานชา |

## กฎอัปเดตเอกสาร (หลังเปลี่ยนโครงสร้างจริง)

**ดีกว่า** มีจุดเดียวที่อัปเดต — ไม่ต้องสร้างไฟล์ snapshot ใหม่ทุก PR

เมื่อ PR แตะอย่างใดอย่างหนึ่งต่อไปนี้ ให้ **อัปเดตเอกสารใน PR เดียวกัน** (ย่อ ๆ พอ):

| เปลี่ยนอะไร | อัปเดตที่ไหน |
|------------|-------------|
| collection / field Firestore ใหม่ | `ARCHITECTURE_TH.md` + `firestore.rules` comment ถ้าจำเป็น |
| โฟลเดอร์/โมดูลใหม่สำคัญ | `PROJECT_STRUCTURE.md` ส่วนที่เกี่ยว |
| พฤติกรรม LINE / ลูกค้า / UID | `LINE_OA_ORDER_SCOPE_TH.md` หรือ `PEACH_WORKING_STYLE_TH.md` |
| กฎทีม / workflow เอเจนต์ | `AGENTS.md` หรือ skill ใน `.cursor/skills/` |
| ตั้งค่าแอดมินใหม่ (`config/*`) | บรรทัดใน `ARCHITECTURE_TH.md` หรือ `PEACH_WORKING_STYLE_TH.md` |

**ไม่ต้อง** copy ทั้ง repo ลงไฟล์ใหม่ทุกครั้ง — แก้ section ที่เกี่ยวพอ

## ลำดับอ่านก่อนลงมือ (กุ้ง)

1. `AGENTS.md`
2. `apps/seafood-pos/AGENTS.md`
3. `docs/PEACH_WORKING_STYLE_TH.md` (ถ้าคุยกับ Peach)
4. `docs/ARCHITECTURE_TH.md` — ส่วนกุ้ง + `lineOrders` / `customers`
5. โค้ดใกล้จุดแก้

## ตรวจสุขภาพก่อน merge

```bash
npm install
node apps/seafood-pos/scripts/smoke-test.mjs   # กุ้ง logic
npm run build --workspace=seafood-pos            # ถ้าแตะแอปกุ้ง
```

Deploy: merge `main` → GitHub Actions (`deploy-hosting.yml`, `deploy-functions.yml` ถ้าแตะ webhook)
