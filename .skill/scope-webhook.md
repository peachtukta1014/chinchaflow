# Scope Guard — webhook (LINE Backend + AI Agent)

> AGENTS.md เต็มอยู่ที่ `apps/webhook-core/AGENTS.md` — อ่านก่อนทุกครั้ง
> เอกสารนี้เพิ่มเฉพาะ **ข้อห้ามชัดเจน + gotchas runtime ที่ไม่อยู่ใน AGENTS.md**

## ห้ามแตะ ❌
- `apps/seafood-pos/`, `apps/chincha-tea/`, `apps/ai-chat/`
- `apps/webhook-core-scheduled/` (codebase แยก — scope=scheduled)

## ตรวจสุขภาพก่อน commit
```bash
node --check apps/webhook-core/src/<ทุกไฟล์ที่แก้>.js
```
ใช้ `exec_command` — ห้าม commit ถ้า syntax error

## Gotchas สำคัญ
- **ห้าม ESM** — `require()` เท่านั้น (Node 20 CommonJS) ห้ามใช้ `import`
- **ByteString error** — HTTP headers ต้อง ASCII ล้วน (`X-Title` ห้ามมี Thai/emoji)
- **DSML strip** — DeepSeek ออก `<|DSML|invoke>` ใน text → strip ก่อน return (`aiChatAgent.js`)
- **reasoning_content** — DeepSeek V4 Pro: multi-turn assistant messages ต้องมี `reasoning_content` ทุก turn (ไม่ส่ง → OpenRouter 400)
- **Flash/Pro isolation** — Flash CF ต้องไม่รู้จัก `OPENROUTER_API_KEY_PRO` / `FIREBASE_SERVICE_ACCOUNT` เลย
- **agentTools.js**: `MAX_ITERATIONS=22`, `CHECKPOINT_INTERVAL=7` — sync อัตโนมัติเข้า `docs/AI_AGENT_SYSTEM.md` + `PRO.md` ผ่าน `sync-ai-constants.yml` (ไม่ต้องแก้ doc เอง แต่ต้องรู้ไว้ว่าค่าจริงคือเท่านี้)
