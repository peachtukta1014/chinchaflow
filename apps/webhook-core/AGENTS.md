# Agent scope — webhook-core (LINE Bot + AI Agent)

งานที่อ้าง **LINE / webhook / บอท / AI agent / Cloud Function** ให้ทำงานในโฟลเดอร์นี้เท่านั้น

## ขอบเขต

- โค้ดหลัก: `apps/webhook-core/src/`
- อย่าแก้ `apps/seafood-pos/` หรือ `apps/chincha-tea/` เว้นแต่ผู้ใช้สั่งชัด
- ไม่มี build step แยก — deploy ผ่าน `deploy-functions.yml` เท่านั้น

## โครงสร้างภายใน

```
src/
├── index.js                  ← export Cloud Functions ทั้งหมด
├── aiChatAgent.js            ← Flash AI (จีจี้แชท) — endpoint หลัก
├── aiWorkflowAgent.js        ← Pro AI (agentic loop) — รันใน GitHub Actions
├── deployNotify.js           ← รับ deploy notification + project tree sync
├── seafood-oa/               ← LINE Bot กุ้ง (webhook, LIFF, order, customer)
├── seafood-notify/           ← LINE push / bill render กุ้ง
├── tea/                      ← LINE Bot ชา + cron summary
└── shared/
    ├── agentTools.js         ← agentic loop (MAX_ITERATIONS=30, CHECKPOINT=9)
    ├── toolDefinitions.js    ← tool schemas (read_file, patch_file, commit_and_pr …)
    ├── toolExecutors.js      ← execute tool calls จริงผ่าน GitHub API
    ├── progressTracker.js    ← Firestore R/W (aiProgress, aiResults, agentRunLogs)
    ├── lineUtils.js          ← LINE reply / push helpers
    └── webhookDedup.js       ← กัน LINE event ซ้ำ
```

## กฎสำคัญ

- **syntax check บังคับ** — ทุก `.js` ที่แก้ต้องผ่าน `node --check <file>` ก่อน commit
- `require()` เท่านั้น — ไม่ใช้ ESM `import` (Cloud Functions Node 20 CommonJS)
- ห้าม expose API key / secret ในโค้ด (ใช้ `process.env.XXX` เสมอ)
- ห้ามเพิ่ม Cloud Function ใหม่โดยไม่ export ใน `index.js`
- ห้ามเปลี่ยน memory / timeout โดยไม่จำเป็น (`aiChatAgentHttp`: 512MB, 540s)

## AI Agent architecture (สำคัญ — อ่านก่อนแก้ AI files)

```
Flash (aiChatAgent.js)          ← Cloud Function, OPENROUTER_API_KEY
  ↓ repository_dispatch
Pro (aiWorkflowAgent.js)        ← GitHub Actions, OPENROUTER_API_KEY_PRO
  ↓ writeResult → Firestore
Flash polling → PWA แสดงผล
```

- Flash CF ต้องไม่รู้จัก `OPENROUTER_API_KEY_PRO` เลย
- Pro เขียน Firestore ผ่าน `FIREBASE_SERVICE_ACCOUNT` (GitHub Secret)
- `progressTracker.js` เป็นตัวกลางเดียวระหว่างสองฝ่าย

## Firestore collections ที่ webhook-core ใช้

| Collection | ใช้โดย | หน้าที่ |
|-----------|--------|---------|
| `aiProgress/{requestId}` | Pro → Flash | สถานะ step ปัจจุบัน |
| `aiResults/{requestId}` | Pro → Flash | ผลลัพธ์สุดท้าย (TTL 2 ชั่วโมง) |
| `agentRunLogs/{requestId}/steps` | Pro | debug log ถาวร |
| `systemConfig/projectTree` | sync-project-tree.yml → Flash | project structure |
| `webhookDedup/{eventId}` | LINE webhook | กัน event ซ้ำ |
| `config/shrimpLine` | กุ้ง LINE Bot | LINE config กุ้ง |
| `config/teaLine` | ชา LINE Bot | LINE config ชา |

## โปรดักชัน

- Functions region: `asia-southeast1`
- Deploy: `deploy-functions.yml` (push main หรือ manual dispatch)
- ดู log: Firebase Console → Functions → Logs

## ก่อนเพิ่ม Cloud Function ใหม่

ตรวจก่อนว่ามี function ที่ทำสิ่งเดียวกันอยู่แล้วหรือเปล่า (`index.js` → ดู exports ทั้งหมด) แล้วแจ้งพี่พีชก่อนเพิ่ม
