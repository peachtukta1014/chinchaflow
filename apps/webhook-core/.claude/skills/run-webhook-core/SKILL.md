---
name: run-webhook-core
description: run, syntax-check, test, verify webhook-core LINE backend Cloud Functions (Flash, Pro, LINE webhook)
---

# run-webhook-core

LINE backend + AI Agent (Cloud Functions v1) — ไม่มี dev server แบบ standalone
ทดสอบได้ผ่าน: syntax check ทุกไฟล์, unit test scripts ใน `scripts/`, และ `smoke-test.mjs` ของ seafood-pos

**ไม่สามารถ `node src/index.js` ตรงๆ ได้** — ต้องการ Firebase Functions runtime + `firebase-admin` credentials

## Prerequisites

```bash
# จาก repo root
npm install
cd apps/webhook-core && npm install
```

## Syntax check (primary agent path)

```bash
# ตรวจทุก .js ใน src/ — ต้องทำก่อน commit ทุกครั้ง (กฎ CLAUDE.md)
find /home/user/chinchaflow/apps/webhook-core/src -name "*.js" | \
  xargs -I{} sh -c 'node --check "$1" && echo "OK: $(basename $1)" || echo "FAIL: $1"' _ {}
```

ผ่านหมด 54 ไฟล์ใน container นี้ (ตรวจแล้ว 2026-06-30)

## Unit test scripts

Test scripts ใน `apps/webhook-core/scripts/` ต้องการ `src/` module ที่ถูกต้อง

```bash
cd /home/user/chinchaflow
node apps/seafood-pos/scripts/smoke-test.mjs   # logic กุ้ง (ไม่ต้อง Firebase)
```

คาด: 14/15 pass — ล้มที่ `shrimpBillServerRender` (logo.jpg ไม่มีใน headless = expected)

## Flash / Pro source files (จุดที่ PR ส่วนใหญ่แตะ)

```
src/aiChatAgent.js          # Flash (จจี้) — LINE webhook → AI classify → dispatch Pro
src/flash/flashContext.js   # Firestore loaders + fetchChatAgentDocs()
src/flash/flashTriggers.js  # tools ที่ Flash ใช้ได้
src/flash/flashPrompts.js   # prompt templates
src/aiWorkflowAgent.js      # Pro agent loop
src/shared/agentTools.js    # MAX_ITERATIONS, SUMMARY_CHECKPOINT (CI auto-sync)
src/shared/progressTracker.js  # aiResults TTL (2 ชั่วโมง)
```

ตรวจแต่ละไฟล์:
```bash
node --check apps/webhook-core/src/flash/flashContext.js
```

## Deploy (production only)

```bash
# ผ่าน GitHub Actions — ไม่รัน local
# push main ที่แตะ apps/webhook-core/** → deploy-functions.yml ทำงานอัตโนมัติ
```

## Gotchas

- **`node src/index.js` crash ทันที** — `firebase-functions/v1` ต้องการ Cloud Functions runtime ไม่ใช่ Node.js ธรรมดา
- **Test scripts ใน `scripts/` ส่วนใหญ่ต้องการ `../src/` module** — บาง script ทำงานได้ บางตัวไม่ได้ขึ้นกับ dependencies
- **syntax check ต้องใช้ absolute path** หรือรันจาก repo root — `node --check` กับ relative path ใน shell loop อาจสับสน cwd
- **`agentTools.js` มี constants ที่ CI auto-sync** — `MAX_ITERATIONS`, `SUMMARY_CHECKPOINT` อย่าแก้ค่า comment ใน `AI_AGENT_SYSTEM.md` ด้วยมือ

## Troubleshooting

| อาการ | สาเหตุ + วิธีแก้ |
|-------|-----------------|
| `Error: Cannot find module 'firebase-functions/v1'` | ต้อง `npm install` ใน `apps/webhook-core/` ก่อน |
| syntax check ผ่านแต่ deploy ล้มเหลว | ดู log ใน `deploy-functions.yml` GitHub Actions |
| `Cannot find module '../src/parseDeliveryDate'` | script นั้นต้องรันจาก `apps/webhook-core/` ไม่ใช่จาก root |
