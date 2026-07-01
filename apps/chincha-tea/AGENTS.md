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

- `.claude/commands/auto-tea.md` — build อัตโนมัติ ตรวจสุขภาพ (`get_skill("auto-tea")`)
- `.claude/commands/ship-tea.md` — **ปิดงานชา:** build ผ่าน → commit → เปิด PR → รอ merge (`get_skill("ship-tea")`) — deploy จริงเกิดหลัง merge `main` ผ่าน `deploy-hosting.yml` อัตโนมัติ
- `apps/chincha-tea/.claude/skills/run-chincha-tea/` — dev server + screenshot (`get_skill("run-chincha-tea")`)
- Repo-wide: `.claude/commands/land-it.md` — เปิด/อัปเดต PR (`get_skill("land-it")`)
