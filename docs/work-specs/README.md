# CHINCHA FLOW Work Specs

`docs/work-specs/` คือพื้นที่เก็บเอกสารสเปกงานราย PR ให้ Codex/Agent อ่านจาก repo ก่อนลงมือ เพื่อลดการ copy prompt ยาวใน Slack

## ขอบเขต

- เป็นเอกสารสั่งงานเฉพาะ PR / เฉพาะรอบงาน
- ไม่ใช่ changelog
- ไม่ใช่ `AGENT_HANDBOOK`
- ไม่ใช่กฎถาวรของ repo
- ใช้แยกงานแต่ละแอปให้ชัดก่อนแก้โค้ด

## Mapping ช่อง Slack → spec → โค้ด

| Slack channel | Work specs | Code scope |
| --- | --- | --- |
| `#chincha-tea-agent` | `docs/work-specs/chincha-tea/` | `apps/chincha-tea/` |
| `#chincha-shrimp-agent` | `docs/work-specs/seafood-pos/` | `apps/seafood-pos/` |
| `#chincha-flow` | `docs/work-specs/webhook-core/` หรือ docs กลาง | `apps/webhook-core/` / repo config |

## กฎใช้งาน

- ถ้า spec อยู่ใน `chincha-tea` ให้แตะ `apps/chincha-tea` เป็นหลัก
- ถ้า spec อยู่ใน `seafood-pos` ให้แตะ `apps/seafood-pos` เป็นหลัก
- ห้ามเอา spec แอปชาไปใช้กับแอปกุ้ง
- ห้ามเอา spec แอปกุ้งไปใช้กับแอปชา
- ถ้าต้องแตะ LINE backend ต้องระบุใน spec ชัดเจนก่อน
