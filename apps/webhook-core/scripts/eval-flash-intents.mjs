#!/usr/bin/env node
/**
 * สนามสอบ AI (จีจี้) — ยิงข้อสอบเข้า classifier ตัวจริง แล้วออกรายงานตาราง
 *
 * รัน:   OPENROUTER_API_KEY=sk-xxx node apps/webhook-core/scripts/eval-flash-intents.mjs
 * CI:    .github/workflows/ai-eval.yml (workflow_dispatch หรือ PR ที่แตะ flash/)
 *
 * เกณฑ์ผ่าน: intent ถูก ≥ 85% (LLM ไม่ deterministic 100% — temp 0.1 แกว่งได้เล็กน้อย)
 * ค่าใช้จ่าย: ~22 calls × Flash ≈ หลักสตางค์ต่อรอบ
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const { classifyAndTranslate } = require('../src/flash/flashTriggers');

const apiKey = (process.env.OPENROUTER_API_KEY || '').trim();
if (!apiKey) {
  console.error('❌ ต้องตั้ง OPENROUTER_API_KEY ก่อนรัน (ใน CI ใช้ secrets.OPENROUTER_API_KEY_PRO)');
  process.exit(1);
}

const PASS_THRESHOLD = 0.85;

// ── ชุดข้อสอบ — ประโยคแบบที่พีชพิมพ์/พูดจริง + เฉลย ─────────────────────────
// scope ใส่เฉพาะข้อที่ชัดเจนไม่กำกวม (ข้อที่คลุมเครือเช็คแค่ intent)
const CASES = [
  // — chat: ถามข้อมูล/คุยทั่วไป/ขอความเห็น —
  { msg: 'สวัสดีครับจีจี้', intent: 'chat' },
  { msg: 'วันนี้ขายกุ้งได้เท่าไหร่', intent: 'chat' },
  { msg: 'สรุปยอดร้านชาเมื่อวานให้หน่อย', intent: 'chat' },
  { msg: 'ราคากุ้งแม่น้ำในตลาดวันนี้เท่าไหร่', intent: 'chat' },
  { msg: 'จีจี้คิดว่าควรขึ้นราคากุ้งใหญ่ไหม', intent: 'chat' },
  { msg: 'ระบบ AI ของเราทำงานยังไงอธิบายหน่อย', intent: 'chat' },
  { msg: 'ช่วยอธิบายหน่อยว่า FIFO ตัดสต๊อกยังไง', intent: 'chat' },
  { msg: 'ขอบคุณครับจีจี้', intent: 'chat' },
  { msg: 'โอเคครับ', intent: 'chat' },

  // — code-action: สั่งแก้/เพิ่มฟีเจอร์ —
  { msg: 'เพิ่มปุ่มรีเฟรชในหน้าสต๊อกกุ้งหน่อย', intent: 'code-action', scope: 'seafood' },
  { msg: 'แก้คำผิดในแอปชา คำว่า สรุบ เป็น สรุป', intent: 'code-action', scope: 'tea' },
  { msg: 'บิลกุ้งไม่ขึ้นเบอร์โทรลูกค้า แก้ให้หน่อย', intent: 'code-action', scope: 'seafood' },
  { msg: 'อยากให้บอทชาสรุปยอดตอน 4 โมงเย็นแทน 5 โมง', intent: 'code-action' },
  { msg: 'เปลี่ยนสีปุ่มบันทึกในหน้าขายชาเป็นสีเขียว', intent: 'code-action', scope: 'tea' },

  // — code-action: รายงานบั๊ก/ขอตรวจสอบ (กฎใหม่ 2026-07-02 — เดิมชอบหลุดเป็น chat) —
  { msg: 'Project Tree ในแอปโหลดไม่ได้ ขึ้น unavailable ช่วยตรวจสอบหน่อย', intent: 'code-action' },
  { msg: 'LINE bot ไม่ตอบข้อความในกลุ่มเลย ช่วยตรวจสอบหน่อย', intent: 'code-action', scope: 'webhook' },
  { msg: 'ทำไมออเดอร์ LINE เมื่อคืนไม่เข้าระบบ ช่วยดูหน่อย', intent: 'code-action', scope: 'webhook' },
  { msg: 'แอปกุ้งกดบันทึกการขายแล้วค้าง ช่วยตรวจสอบ', intent: 'code-action', scope: 'seafood' },
  { msg: 'หน้า Tokens โหลดไม่ได้ ขึ้น error ครับ', intent: 'code-action' },
  { msg: 'เช็คหน่อยว่าทำไมรูปสลิปอัพโหลดไม่ได้', intent: 'code-action' },
  { msg: 'หน้าสรุปยอดร้านชาแสดงตัวเลขผิด ช่วยแก้ให้หน่อย', intent: 'code-action', scope: 'tea' },
  { msg: 'ระบบแจ้งเตือน LINE พังอีกแล้ว ตรวจสอบที', intent: 'code-action', scope: 'webhook' },
];

function fmtResult(r) {
  return r.pass ? '✅' : '❌';
}

const rows = [];
let passed = 0;

console.log(`\n🧪 สนามสอบ AI — ${CASES.length} ข้อ (classifier: classifyAndTranslate)\n`);

for (const [i, c] of CASES.entries()) {
  let got = null;
  let error = '';
  try {
    got = await classifyAndTranslate(apiKey, c.msg, [], 'root', null);
  } catch (err) {
    error = err.message;
  }
  const gotIntent = got?.intent || `(error: ${error})`;
  const gotScope = got?.scope || '';
  const intentOk = gotIntent === c.intent;
  // scope เช็คเฉพาะข้อที่มีเฉลย scope และ intent ถูกแล้วเท่านั้น
  const scopeOk = !c.scope || (intentOk && gotScope === c.scope);
  const pass = intentOk && scopeOk;
  if (pass) passed += 1;
  const detail = !intentOk
    ? `ได้ ${gotIntent}`
    : (!scopeOk ? `intent ถูกแต่ scope ได้ ${gotScope} (เฉลย ${c.scope})` : '');
  rows.push({ n: i + 1, msg: c.msg, expected: c.intent + (c.scope ? `/${c.scope}` : ''), got: gotIntent + (gotScope ? `/${gotScope}` : ''), pass, detail });
  console.log(`${pass ? '✅' : '❌'} [${i + 1}/${CASES.length}] "${c.msg}" → ${gotIntent}${gotScope ? '/' + gotScope : ''}${detail ? ` — ${detail}` : ''}`);
}

const rate = passed / CASES.length;
const summary = `ผ่าน ${passed}/${CASES.length} (${Math.round(rate * 100)}%) — เกณฑ์ ${Math.round(PASS_THRESHOLD * 100)}%`;

// ── รายงาน markdown (PR comment + step summary) ─────────────────────────────
const md = [
  `## 🧪 สนามสอบ AI (จีจี้ classifier)`,
  '',
  `**${rate >= PASS_THRESHOLD ? '✅ ผ่าน' : '❌ ตก'}** — ${summary}`,
  '',
  '| # | ข้อสอบ | เฉลย | AI ตอบ | ผล |',
  '|---|--------|------|--------|----|',
  ...rows.map(r => `| ${r.n} | ${r.msg} | \`${r.expected}\` | \`${r.got}\` | ${fmtResult(r)}${r.detail ? ' ' + r.detail : ''} |`),
  '',
  `_model: DeepSeek V4 Flash · temp 0.1 · รันเมื่อ ${new Date().toISOString()}_`,
].join('\n');

fs.writeFileSync('eval-report.md', md);
if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
}

console.log(`\n${rate >= PASS_THRESHOLD ? '✅' : '❌'} ${summary}`);
console.log('รายงานเต็ม: eval-report.md');

process.exit(rate >= PASS_THRESHOLD ? 0 : 1);
