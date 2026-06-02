# Agent scope — แอปชา (chincha-tea)

งานจาก Slack ช่อง `#chincha-tea-agent` หรือข้อความที่อ้าง **ชา / tea / chincha-tea** ให้ทำงานในโฟลเดอร์นี้เท่านั้น

## ขอบเขต

- โค้ดหลัก: `apps/chincha-tea/`
- อย่าแก้ `apps/seafood-pos/` เว้นแต่ผู้ใช้สั่งชัด
- LINE / Cloud Functions: `apps/webhook-core/` เฉพาะเมื่อสั่ง webhook ชา

## คำสั่งที่ใช้บ่อย

```bash
npm run dev:tea
npm run build --workspace=chincha-tea
```

## โปรดักชัน

https://chincha-tea.web.app

## Firebase

ใช้ `apps/chincha-tea/.env.local` (`VITE_FIREBASE_*`) — `VITE_FIREBASE_APP_ID` ของชา (ต่างจากกุ้ง)

## Skills (เฉพาะแอปนี้)

- `.cursor/skills/auto-tea/` — build อัตโนมัติ รายงานสุขภาพ (เรียก `/auto-tea`)
- `.cursor/skills/deploy-tea/` — build และ deploy ชา (เรียก `/deploy-tea`)
- `.cursor/skills/ship-tea/` — **ปิดงานชา:** build ผ่าน → merge PR เข้า `main` → รอ deploy (เรียก `/ship-tea`)
- Repo-wide: `.cursor/skills/land-it/` — เปิด/อัปเดต PR (`/land-it`)
