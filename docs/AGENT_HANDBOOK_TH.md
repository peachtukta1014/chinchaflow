# คู่มือเอเจนต์ — โครงสร้าง repo และการอัปเดตเอกสาร

ให้ทุกรอบงาน (จีจี้, Claude Code) เริ่มจากที่นี่ + `AGENTS.md`

## เมื่อมีปัญหา / บั๊ก (ขั้นแรก)

1. อ่าน **`docs/AGENT_CHANGELOG_TH.md`** — รอบก่อนแตะจุดไหน (เริ่มแก้จากตรงนั้น)
2. อ่าน entry ที่เกี่ยว + ไฟล์ที่ระบุ
3. ค่อยไล่โค้ด / reproduce

เมื่อ **merge งานที่เปลี่ยนพฤติกรรม** → เพิ่ม entry บนสุดใน `AGENT_CHANGELOG_TH.md` (ใน PR เดียวกัน)

## แผนที่ repo (สรุป)

```
CHINCHA FLOW (ระบบรวม) · repo chincha-business-os · Firebase chincha-eeed6
├── apps/chincha-tea/      # ชินชา Tea POS · chincha-tea.web.app
├── apps/seafood-pos/      # โกอ้วน คลังซีฟู้ด · ko-seafood.top
├── apps/ai-chat/          # AI Admin Chat · chincha-ai-chat.web.app
├── apps/webhook-core/     # LINE backend + AI Agent · asia-southeast1
├── firestore.rules        # กฎ Firestore ร่วม
├── .github/workflows/     # deploy hosting / functions / rules
├── docs/                  # เอกสารทีม + สถาปัตยกรรม
├── .claude/commands/      # land-it, peter-ser, ship-*, auto-* (Claude Code skills)
└── .skill/                # scope-*.md (AI agent guardrail skills)
```

รายละเอียดเชิงลึก:

| เอกสาร | ใช้เมื่อไหร่ |
|--------|-------------|
| [CHINCHA_FLOW_NAMING_TH.md](./CHINCHA_FLOW_NAMING_TH.md) | ชื่อระบบ CHINCHA FLOW vs repo, คำเรียกสากล (ไม่ใช่แค่ POS) |
| [ARCHITECTURE_TH.md](./ARCHITECTURE_TH.md) | ภาพรวมระบบ, Firestore collections, deploy — AI agent สรุปสั้น (รายละเอียดครบ → AI_AGENT_SYSTEM.md) |
| [AI_AGENT_SYSTEM.md](./AI_AGENT_SYSTEM.md) | สถาปัตยกรรม AI ครบชุด — Flash/Pro/scopes/loop limits/key files (Flash อ่านส่วนแรก, Pro อ่านทั้งหมด) |
| [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) | โฟลเดอร์/ไฟล์สำคัญแต่ละแอป |
| [LINE_OA_ORDER_SCOPE_TH.md](./LINE_OA_ORDER_SCOPE_TH.md) | ขอบเขต LINE OA กุ้ง, LIFF, Rich Menu |
| [LINE_OA_PARTITION_TH.md](./LINE_OA_PARTITION_TH.md) | จัด partition LINE 4 สายงาน (OA กุ้ง · ครอบครัวกุ้ง · แจ้งเตือนกุ้ง · แอปชา) |
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
| พฤติกรรม LINE / ลูกค้า / UID | `LINE_OA_ORDER_SCOPE_TH.md` หรือ `LINE_OA_PARTITION_TH.md` หรือ `PEACH_WORKING_STYLE_TH.md` |
| กฎทีม / workflow เอเจนต์ | `AGENTS.md` หรือ `.claude/commands/` |
| ตั้งค่าแอดมินใหม่ (`config/*`) | บรรทัดใน `ARCHITECTURE_TH.md` หรือ `PEACH_WORKING_STYLE_TH.md` |

**ไม่ต้อง** copy ทั้ง repo ลงไฟล์ใหม่ทุกครั้ง — แก้ section ที่เกี่ยวพอ

## แผนพัฒนา AI Loop (Roadmap) — อัปเดต 2026-06-29

ตรวจสอบจุดนี้ก่อนลงมือแก้ระบบ AI เพื่อให้รู้ว่าทำไปถึงไหนแล้ว

| # | เรื่อง | สถานะ | PR |
|---|--------|-------|-----|
| 1 | เลื่อน SUMMARY_CHECKPOINT จากรอบ 25 → 8-10 เพื่อลด context สะสม | ✅ เสร็จแล้ว (→ 9) + save summary Firestore | #432 |
| 2 | ตรวจ payload รวม (requestId + history + Brief) ต้องไม่เกิน 10KB ก่อน dispatch | ✅ เสร็จแล้ว (size check 9800 bytes + error ถ้าเกิน) | #432 |
| 3 | commit_and_pr atomicity — ป้องกัน orphan branch เมื่อ commit ผ่านแต่ PR fail | ✅ เสร็จแล้ว (delete orphan branch + retry hint) | #435 |
| 4 | Flash retry 1 ครั้งเมื่อ dispatch ล้มเหลว (non-204) | ✅ เสร็จแล้ว (retry 1 ครั้ง หลัง 2s) | #432 |
| 5 | Flash สรุปงาน + รอ "ไฟเขียว" ก่อน dispatch Pro ทุกครั้ง | ✅ เสร็จแล้ว | #429 |
| 6 | Monitoring dashboard — runs/วัน, ต้นทุน/task, success rate จาก tokenLogs | ✅ เสร็จแล้ว (stats block บน TokenDashboard) | #434 |
| 7 | compact Task Brief — Flash ย่อบริบทเป็น 4 บรรทัด ส่ง Pro (งาน/ไฟล์/อ่านก่อน/กฎ) | ✅ เสร็จแล้ว | #431 |

**ไฟล์ที่เกี่ยวข้องกับ AI loop:**
- Flash: `apps/webhook-core/src/aiChatAgent.js`, `flash/flashTriggers.js`, `flash/flashContext.js`
- Pro: `apps/webhook-core/src/shared/agentTools.js` (MAX_ITERATIONS, CHECKPOINT_INTERVAL อยู่ที่นี่)
- Workflow: `.github/workflows/ai-workflow-trigger.yml`

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
