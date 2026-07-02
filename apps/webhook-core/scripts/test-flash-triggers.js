#!/usr/bin/env node
// เทสส่วน deterministic ของ Flash — quick triggers, normalizeThai, buildTaskBrief
// (ส่วนที่ต้องเรียก LLM จริงอยู่ใน eval-flash-intents.mjs — คนละตัว)
const {
  normalizeThai,
  detectQuickTrigger,
  isCodeMetricsQuery,
  buildTaskBrief,
  repairJson,
} = require('../src/flash/flashTriggers');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  console.log('ok:', msg);
}

// ── quick triggers — health check bypass classifier ──
assert(detectQuickTrigger('โอเคกุ้ง')?.scope === 'seafood', 'โอเคกุ้ง → quick trigger seafood');
assert(detectQuickTrigger('ตรวจชา')?.scope === 'tea', 'ตรวจชา → quick trigger tea');
assert(detectQuickTrigger('วันนี้ขายกุ้งได้เท่าไหร่') === null || detectQuickTrigger('วันนี้ขายกุ้งได้เท่าไหร่') === undefined, 'คำถามทั่วไปไม่ชน quick trigger');
assert(detectQuickTrigger('โอเคกุ้งช่วยแก้บั๊กหน่อย') == null, 'ประโยคยาวที่มีคำ trigger ปน → ไม่ชน (ต้อง exact)');

// ── normalizeThai — สระ/วรรณยุกต์สลับจากมือถือ ──
assert(normalizeThai('กุ่ง'.normalize()) === 'กุ่ง'.normalize(), 'ข้อความปกติไม่เปลี่ยน');

// ── isCodeMetricsQuery ──
assert(isCodeMetricsQuery('โปรเจกต์เรามีกี่บรรทัดแล้ว'), 'ถามจำนวนบรรทัด → code metrics');
assert(!isCodeMetricsQuery('ขายกุ้งได้กี่โล'), 'ถามยอดขาย → ไม่ใช่ code metrics');

// ── buildTaskBrief — schema ใหม่ {path, fn} ──
const brief = buildTaskBrief({
  taskSpec: {
    description: 'แก้ Project Tree โหลดไม่ได้',
    target_behavior: 'เปิดแท็บแล้วเห็นโครงสร้างโปรเจกต์',
    logic_constraints: ['ห้ามแตะ collection อื่น'],
    files_hint: [{ path: 'apps/ai-chat/src/firebase.js', fn: 'getProjectTree' }],
    diff_expectation: 'แก้ transport เป็น REST',
  },
}, 'ข้อความเดิม');
assert(brief.includes('แก้ Project Tree โหลดไม่ได้'), 'brief มี description');
assert(brief.includes('Target Behavior'), 'brief มี target behavior');
assert(brief.includes('apps/ai-chat/src/firebase.js') && brief.includes('getProjectTree'), 'brief มีไฟล์+fn');
assert(brief.includes('ห้ามแตะ collection อื่น'), 'brief มี constraints');

// ── buildTaskBrief — schema เก่า string[] ยังใช้ได้ ──
const legacy = buildTaskBrief({
  taskSpec: { description: 'งานเก่า', files_hint: ['apps/x/y.js'] },
}, 'ข้อความเดิม');
assert(legacy.includes('apps/x/y.js'), 'files_hint แบบ string เดิมยังรองรับ');

// ── buildTaskBrief — taskSpec ว่าง → fallback ข้อความเดิม ──
assert(buildTaskBrief({}, 'ข้อความ fallback').includes('ข้อความ fallback'), 'ไม่มี taskSpec → ใช้ข้อความเดิม');

// ── repairJson — ซ่อม JSON เสียจาก DeepSeek V4 Flash ──

// trailing comma ก่อน } หรือ ]
assert(JSON.parse(repairJson('{"intent":"chat",}')).intent === 'chat', 'repair: trailing comma ก่อน }');
assert(JSON.parse(repairJson('{"a":["x","y",]}')).a.length === 2, 'repair: trailing comma ก่อน ]');

// single quotes → double quotes (เมื่อ ' มากกว่า ")
assert(JSON.parse(repairJson("{'intent':'code-action'}")).intent === 'code-action', 'repair: single quotes → double quotes');

// markdown ```json wrapper
assert(JSON.parse(repairJson('```json\n{"intent":"chat"}\n```')).intent === 'chat', 'repair: strip ```json wrapper');

// inline comment หลัง comma
assert(JSON.parse(repairJson('{"intent":"chat", // ตอบแชท\n"scope":"root"}')).scope === 'root', 'repair: strip inline comment');

// control characters (unescaped newline ใน value)
const withNewline = '{"desc":"line1\nline2"}';
const repairedNewline = repairJson(withNewline);
assert(JSON.parse(repairedNewline).desc === 'line1\nline2', 'repair: unescaped newline → escaped \\n');

// ซ้อนหลาย error พร้อมกัน (trailing comma + comment)
const messy = '{"intent":"code-action", // task\n"scope":"tea",}';
assert(JSON.parse(repairJson(messy)).intent === 'code-action', 'repair: ซ้อนหลาย error');

// JSON ปกติ → ไม่เปลี่ยน
const normal = '{"intent":"chat","scope":"root"}';
assert(JSON.parse(repairJson(normal)).intent === 'chat', 'repair: JSON ปกติ → ไม่เปลี่ยน');

console.log('test-flash-triggers: ok');
