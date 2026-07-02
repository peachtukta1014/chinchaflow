#!/usr/bin/env node
/**
 * สนามสอบ AI (จีจี้) — ยิงข้อสอบเข้า classifier ตัวจริง แล้วออกรายงานตาราง
 *
 * รัน:   OPENROUTER_API_KEY=sk-xxx node apps/webhook-core/scripts/eval-flash-intents.mjs
 * CI:    .github/workflows/ai-eval.yml (workflow_dispatch หรือ PR ที่แตะ flash/)
 *
 * เกณฑ์ผ่าน: intent ถูก ≥ 85% (LLM ไม่ deterministic 100% — temp 0 แกว่งได้เล็กน้อย)
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

// ── ชุดข้อสอบ — สะท้อน workflow จริงของจีจี้ ────────────────────────────────
// พีชอธิบายปัญหาเป็นภาษาชาวบ้าน (มักพูดผ่านเสียง ถอดความเพี้ยนบ้าง ประโยควกวนบ้าง)
// → จีจี้ต้องแยกให้ออกว่าอันไหนคือ "งานระบบ" (code-action: วิเคราะห์ → อ่านโค้ดจริง
//   → สรุปภาษาชาวบ้านรอไฟเขียว) กับอันไหนแค่คุย/ถามข้อมูล (chat)
// scope ใส่เฉพาะข้อที่ชัดเจนไม่กำกวม (ข้อที่คลุมเครือเช็คแค่ intent)
const CASES = [
  // — chat: ทักทาย/ถามข้อมูล/ขอความเห็น (ระบบปกติดี) —
  { msg: 'สวัสดีครับจีจี้', intent: 'chat' },
  { msg: 'วันนี้ขายกุ้งได้เท่าไหร่ครับ', intent: 'chat' },
  { msg: 'สรุปยอดร้านชาเมื่อวานให้หน่อย', intent: 'chat' },
  { msg: 'ราคากุ้งแม่น้ำในตลาดช่วงนี้ประมาณเท่าไหร่', intent: 'chat' },
  { msg: 'พี่ว่าเราควรขึ้นราคากุ้งใหญ่ไหมช่วงนี้ของแพงขึ้นเยอะ', intent: 'chat' },
  { msg: 'ช่วยอธิบายหน่อยว่าระบบตัดสต๊อก FIFO ของเราทำงานยังไง', intent: 'chat' },
  { msg: 'โอเคครับขอบคุณมากจีจี้', intent: 'chat' },

  // — code-action: สั่งแก้/เพิ่มฟีเจอร์ (ภาษาสั่งงานตรงๆ) —
  { msg: 'เพิ่มปุ่มรีเฟรชในหน้าสต๊อกกุ้งให้หน่อย', intent: 'code-action', scope: 'seafood' },
  { msg: 'แก้คำผิดในแอปชา คำว่า สรุบ เป็น สรุป', intent: 'code-action', scope: 'tea' },
  { msg: 'เปลี่ยนสีปุ่มบันทึกในหน้าขายชาเป็นสีเขียว', intent: 'code-action', scope: 'tea' },
  { msg: 'อยากให้บอทชาส่งสรุปยอดตอน 4 โมงเย็นแทน 5 โมงอ่ะ ปรับให้หน่อย', intent: 'code-action' },
  { msg: 'บิลกุ้งไม่ขึ้นเบอร์โทรลูกค้า แก้ให้หน่อย', intent: 'code-action', scope: 'seafood' },
  { msg: 'ช่วยเพิ่มช่องหมายเหตุตอนรับกุ้งเข้าสต๊อกหน่อย พี่จะได้จดว่าล็อตไหนของเจ้าไหน', intent: 'code-action', scope: 'seafood' },
  { msg: 'หน้าสรุปยอดร้านชาแสดงตัวเลขผิด ช่วยแก้ให้หน่อย', intent: 'code-action', scope: 'tea' },

  // — code-action: พีชเล่าปัญหาแบบภาษาพูด/เสียงถอดความ → จีจี้ต้องรับไปวิเคราะห์+อ่านโค้ด —
  { msg: 'จีจี้ตรวจสอบแอปร้านชาส่วนที่ดึงกรุ๊ปไอดีของ LINE ให้หน่อย เพราะตรงนั้นมันยังดึงไม่ได้ แชทกลุ่มมันบอกว่ากรุ๊ปไอดีไม่ตรง', intent: 'code-action' },
  { msg: 'พี่เจอปัญหาอ่ะ ลูกค้าสั่งกุ้งมาทางไลน์แล้วออเดอร์มันไม่ขึ้นในแอปเลย ช่วยดูให้หน่อยว่าเป็นที่อะไร', intent: 'code-action' },
  { msg: 'Project Tree ในแอปโหลดไม่ได้ ขึ้น unavailable ช่วยตรวจสอบหน่อย', intent: 'code-action' },
  { msg: 'แอปกุ้งอ่ะ กดบันทึกการขายแล้วมันค้างเฉยเลย ช่วยตรวจสอบที', intent: 'code-action', scope: 'seafood' },
  { msg: 'เมื่อคืนบอทไม่ส่งสรุปยอดเข้ากลุ่มไลน์เลย ทำไมอ่ะ ช่วยดูหน่อย', intent: 'code-action', scope: 'webhook' },
  { msg: 'เช็คหน่อยว่าทำไมรูปสลิปอัพโหลดไม่ได้', intent: 'code-action' },
  { msg: 'ระบบแจ้งเตือน LINE พังอีกแล้ว ตรวจสอบที', intent: 'code-action', scope: 'webhook' },
  { msg: 'ตะกี้พนักงานบอกว่าหน้าจอขายชามันเด้งออกเองตอนกดเก็บเงิน ลองไปดูให้หน่อยว่าเกิดอะไรขึ้น', intent: 'code-action', scope: 'tea' },
];

function fmtResult(r) {
  return r.pass ? '✅' : '❌';
}

const rows = [];
let passed = 0;

// ยิงข้อสอบ 1 ครั้ง — คืนผลตรวจเทียบเฉลย
async function runCase(c) {
  const got = await classifyAndTranslate(apiKey, c.msg, [], 'root', null);
  const gotIntent = got?.intent || '(no intent)';
  const gotScope = got?.scope || '';
  const intentOk = gotIntent === c.intent;
  // scope เช็คเฉพาะข้อที่มีเฉลย scope และ intent ถูกแล้วเท่านั้น
  const scopeOk = !c.scope || (intentOk && gotScope === c.scope);
  return { pass: intentOk && scopeOk, gotIntent, gotScope, intentOk, scopeOk };
}

console.log(`\n🧪 สนามสอบ AI — ${CASES.length} ข้อ (classifier: classifyAndTranslate · ตกแล้วสอบซ่อม 1 ครั้ง)\n`);

for (const [i, c] of CASES.entries()) {
  let r;
  let retried = false;
  try {
    r = await runCase(c);
    if (!r.pass) {
      // สอบซ่อม 1 ครั้ง — OpenRouter สลับ provider หลังบ้านทำให้ temp 0 ยังไม่ deterministic
      // ข้ามรอบ (เห็นจริง: ข้อเดิมผ่าน/ตกสลับกันแต่ละรอบ) — เหมือนพีชพิมพ์ซ้ำอีกรอบ
      retried = true;
      r = await runCase(c);
    }
  } catch (err) {
    r = { pass: false, gotIntent: `(error: ${err.message})`, gotScope: '', intentOk: false, scopeOk: false };
  }
  if (r.pass) passed += 1;
  const detail = !r.intentOk
    ? `ได้ ${r.gotIntent}`
    : (!r.scopeOk
      ? `intent ถูกแต่ scope ได้ ${r.gotScope} (เฉลย ${c.scope})`
      : (retried ? 'ผ่านรอบสอบซ่อม' : ''));
  rows.push({ n: i + 1, msg: c.msg, expected: c.intent + (c.scope ? `/${c.scope}` : ''), got: r.gotIntent + (r.gotScope ? `/${r.gotScope}` : ''), pass: r.pass, detail });
  console.log(`${r.pass ? '✅' : '❌'} [${i + 1}/${CASES.length}] "${c.msg}" → ${r.gotIntent}${r.gotScope ? '/' + r.gotScope : ''}${detail ? ` — ${detail}` : ''}`);
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
  `_model: DeepSeek V4 Flash · temp 0 · รันเมื่อ ${new Date().toISOString()}_`,
].join('\n');

fs.writeFileSync('eval-report.md', md);
if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
}

console.log(`\n${rate >= PASS_THRESHOLD ? '✅' : '❌'} ${summary}`);
console.log('รายงานเต็ม: eval-report.md');

process.exit(rate >= PASS_THRESHOLD ? 0 : 1);
