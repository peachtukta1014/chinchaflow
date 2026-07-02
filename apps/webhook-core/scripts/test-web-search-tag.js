#!/usr/bin/env node
// เทสจับ/ลบแท็ก [WEB_SEARCH:] — ครอบเคสจริงที่เคยหลุด (DeepSeek เกริ่นก่อนใส่แท็ก)
const {
  matchWebSearchQuery,
  stripWebSearchTags,
} = require('../src/flash/webSearchTag');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  console.log('ok:', msg);
}

// ── แท็กอยู่ต้นข้อความ (เคสตามโปรโตคอล) ──
assert(
  matchWebSearchQuery('[WEB_SEARCH: shrimp market price thailand]') === 'shrimp market price thailand',
  'แท็กต้นข้อความ → ได้ query',
);

// ── แท็กอยู่หลังคำเกริ่น (เคสจริงที่เคยหลุด 2026-07-02) ──
const preamble = 'เข้าใจแล้วครับพี่พีช! ขออ่านไฟล์ที่เกี่ยวข้องก่อนนะคะ\n\n`[WEB_SEARCH: how to debug React component]`';
assert(
  matchWebSearchQuery(preamble) === 'how to debug React component',
  'แท็กหลังคำเกริ่น → ยังจับได้ (regex ห้าม anchor ^)',
);

// ── ไม่มีแท็ก ──
assert(matchWebSearchQuery('สวัสดีครับพี่พีช วันนี้ขายดีไหมครับ') === null, 'ไม่มีแท็ก → null');
assert(matchWebSearchQuery('') === null, 'ข้อความว่าง → null');
assert(matchWebSearchQuery(null) === null, 'null → null');

// ── strip: ลบแท็กออกหมด ไม่เหลือให้พีชเห็น ──
const stripped = stripWebSearchTags(preamble);
assert(!stripped.includes('[WEB_SEARCH'), 'strip แล้วไม่เหลือแท็ก');
assert(stripped.includes('เข้าใจแล้วครับพี่พีช'), 'strip แล้วข้อความเดิมยังอยู่');

// ── strip: หลายแท็กในข้อความเดียว ──
const multi = 'ก่อนอื่น [WEB_SEARCH: query one] แล้วก็ [WEB_SEARCH: query two] จบ';
assert(!stripWebSearchTags(multi).includes('WEB_SEARCH'), 'strip หลายแท็กออกหมด');

// ── strip: ยุบบรรทัดว่างซ้อนหลังลบแท็ก ──
const blanky = 'บรรทัดแรก\n\n[WEB_SEARCH: x]\n\nบรรทัดท้าย';
assert(!/\n{3,}/.test(stripWebSearchTags(blanky)), 'ไม่มีบรรทัดว่างเกิน 2 หลัง strip');

// ── strip: ข้อความไม่มีแท็ก ต้องไม่เพี้ยน ──
assert(stripWebSearchTags('ตอบปกติครับพี่') === 'ตอบปกติครับพี่', 'ไม่มีแท็ก → ข้อความเดิม');

console.log('test-web-search-tag: ok');
