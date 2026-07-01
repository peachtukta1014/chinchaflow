// Quick triggers, intent classifier, and task brief builder for Flash (จีจี้)
const { OPENROUTER_BASE, FLASH_MODEL } = require('./flashModels');

// มือถือบางรุ่น input สระล่าง (ุ ู) หลัง tone mark → swap ให้ตรงมาตรฐาน
function normalizeThai(str) {
  return str.replace(/([่-๋])([ุู])/g, '$2$1');
}

// bypass classifier — health check เท่านั้น ห้าม commit
function detectQuickTrigger(message) {
  const m = normalizeThai((message || '').trim().toLowerCase());
  if (/^(checking|โอเคกุ้ง|ตรวจกุ้ง|auto-shrimp|เช็คกุ้ง|ok กุ้ง|okกุ้ง)$/.test(m)) {
    return {
      scope: 'seafood',
      task: `ตรวจสุขภาพ seafood-pos (โกอ้วนซีฟู้ด/ร้านกุ้ง):
1. อ่าน apps/seafood-pos/scripts/smoke-test.mjs ดู test cases ทั้งหมด
2. อ่าน apps/seafood-pos/src/utils/pricing.js หรือไฟล์ logic ราคาหลัก ตรวจว่า logic ถูกต้อง
3. อ่าน apps/seafood-pos/package.json ดู dependencies

รายงานสรุปสั้น:
- ✅ ปกติ: [ส่วนที่ดี]
- ⚠️ ควรระวัง: [ถ้ามี]
- ❌ มีปัญหา: [ถ้ามี]

สำคัญ: ตรวจสอบและรายงานเท่านั้น ห้าม commit ห้ามแก้ไฟล์ ห้ามเปิด PR`,
    };
  }
  if (/^(โอเคชา|ตรวจชา|auto-tea|เช็คชา|ok ชา|okชา)$/.test(m)) {
    return {
      scope: 'tea',
      task: `ตรวจสุขภาพ chincha-tea (ร้านชินชา):
1. อ่าน apps/chincha-tea/package.json ดู dependencies
2. อ่าน apps/chincha-tea/src/ ดูไฟล์หลัก ตรวจว่าโครงสร้างปกติ

รายงานสรุปสั้น:
- ✅ ปกติ: [ส่วนที่ดี]
- ⚠️ ควรระวัง: [ถ้ามี]
- ❌ มีปัญหา: [ถ้ามี]

สำคัญ: ตรวจสอบและรายงานเท่านั้น ห้าม commit ห้ามแก้ไฟล์ ห้ามเปิด PR`,
    };
  }
  return null;
}

function isCodeMetricsQuery(text) {
  if (!text || text.length > 600 || text.includes('```')) return false;
  const t = text.toLowerCase();
  return /(นับบรรทัด|กี่บรรทัด|บรรทัดทั้งหมด|จำนวนบรรทัด|ความยาวโค้ด|โปรเจกต์ใหญ่แค่ไหน|code\s*metric)/.test(t);
}

// รับภาษาชาวบ้านจากพีช → ถอดรหัสเป็น Technical Specification → สร้าง Task Brief ส่งให้ Pro
async function classifyAndTranslate(apiKey, message, history, currentScope) {
  const systemPrompt = `คุณคือจีจี้ — Technical Translator & Project Director ของ CHINCHA FLOW
หน้าที่: ถอดรหัสภาษาชาวบ้านของพี่พีช → Technical Specification ที่สมบูรณ์ → Pro Developer รัน read_file ถูกจุดทันทีในรอบแรก ไม่หลงทาง

CHINCHA FLOW scopes:
- ร้านชินชา/ชา/chincha-tea (scope: tea) — apps/chincha-tea/, POS ขายชา, สต๊อกแก้ว, พนักงาน, LINE บอทชา
- โกอ้วนซีฟู้ด/ร้านกุ้ง/seafood (scope: seafood) — apps/seafood-pos/, POS ขายกุ้ง, สต๊อก FIFO, ลูกค้า, LINE LIFF
- LINE Bot/webhook (scope: webhook) — apps/webhook-core/, บอทกลุ่ม, webhook events, Cloud Functions
- ทั่วไป/หลายส่วน (scope: root)

วิเคราะห์คำสั่ง → ตอบ JSON เท่านั้น (ไม่มีข้อความอื่น):

กรณี code-action (แก้/เพิ่ม/ดูโค้ดจริง):
{
  "intent": "code-action",
  "scope": "tea|seafood|webhook|root",
  "taskSpec": {
    "description": "[1 ประโยค: แก้/เพิ่มอะไร ที่ function/component ไหน — ระบุชื่อเจาะจง]",
    "target_behavior": "[พฤติกรรมสุดท้ายที่ระบบต้องทำ — มุม user/system: 'เมื่อ X เกิดขึ้น ผลลัพธ์ต้องเป็น Y ไม่ใช่ Z']",
    "logic_constraints": [
      "invariant ทางเทคนิคหรือกฎธุรกิจที่ห้ามละเมิด — เจาะจงถึงระดับ function เช่น 'ห้าม mutate stockBatches โดยตรง ต้องผ่าน saleFifo()'",
      "ใส่เฉพาะที่เกี่ยวกับงานนี้จริงๆ"
    ],
    "files_hint": [
      {"path": "apps/.../ไฟล์หลักที่แก้.js", "fn": "functionName — บทบาทในงานนี้"},
      {"path": "apps/.../ไฟล์อ่านประกอบ.js", "fn": "อ่านก่อน — เพื่อเข้าใจ context"}
    ],
    "diff_expectation": "[1-2 ประโยค: Pro จะเปลี่ยนอะไรในโค้ด — ระดับ logic/ค่า/condition ไม่ต้องระบุบรรทัด]"
  },
  "isHighRisk": true,
  "confirmation": "[1 ประโยค: สรุปงานกระชับ]",
  "needsConfirmation": true,
  "confirmationMessage": "[ดูรูปแบบด้านล่าง]"
}

กฎ files_hint — ระบุ path จริง + ชื่อ function ที่ Pro ต้อง read_file เป็นอันดับแรก:
- files_hint[0] = ไฟล์หลักที่ต้องแก้ + fn = ชื่อ function/component เจาะจง
- files_hint[1-2] = ไฟล์อ่านประกอบ + fn = "อ่านก่อน — [เหตุผล]"
- seafood: apps/seafood-pos/src/utils/pricing.js, src/services/saleFifo.js, src/screens/, src/liff/
- tea: apps/chincha-tea/src/lib/, src/services/, src/screens/, src/components/
- webhook: apps/webhook-core/src/ (aiChatAgent.js, aiWorkflowAgent.js, flash/, shared/)
- ถ้าไม่แน่ใจ path: เดาได้ แต่ fn ต้องบอกว่า "Pro ค้นหาเพิ่มเองได้"

กฎ logic_constraints — ใส่เฉพาะที่เกี่ยวกับงานนี้:
- seafood ราคา: "ราคาต้องไม่ติดลบ", "ห้ามแตะ saleFifo() โดยตรง"
- tea สต๊อก: "ห้ามแตะ dailyCupStocks นอกจาก inventoryService.js"
- ถ้าไม่มีกฎพิเศษ → []

กฎ isHighRisk:
- true: ราคา/VAT/ส่วนลด, FIFO (stockBatches), lineOrders, lineUserId/roles, Firestore schema, auth/uid, flow POS หลัก, แก้ >3 ไฟล์
- false: ข้อความ/typo, UI สี/icon/layout, log/comment/doc, เพิ่ม UI เล็กๆ

รูปแบบ confirmationMessage (Technical Director tone — แม่นยำ กระชับ):
"📋 จีจี้แปลงงานแล้วนะครับพี่\\n\\n🎯 งาน: [description]\\n▸ ผลลัพธ์: [target_behavior]\\n📁 ไฟล์: [files_hint[0].path] → [fn]\\n⚠️ Risk: [low/medium/high — เหตุผลสั้นๆ]\\n❌ ห้ามแตะ: [สรุป logic_constraints]\\n\\n[💡 ถ้ามีข้อควรระวังพิเศษ — แจ้งตรงๆ]\\n\\nพิมพ์ \\"ไฟเขียว\\" เพื่อส่งงานให้ V4-Pro ได้เลยครับ 🟢"

กรณี chat (ถาม/คุยทั่วไป/ขอความเห็น):
{"intent":"chat"}

ถ้าไม่แน่ใจ → เลือก chat เสมอ (ปลอดภัยกว่า)`;

  try {
    const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://chincha-flow.web.app',
        'X-Title': 'CHINCHA FLOW Intent Classifier',
      },
      body: JSON.stringify({
        model: process.env.FLASH_MODEL || FLASH_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          ...(history || []).slice(-3),
          { role: 'user', content: message },
        ],
        temperature: 0.1,
        max_tokens: 900,
      }),
    });
    if (!res.ok) return { intent: 'chat' };
    const data = await res.json();
    const responseText = data?.choices?.[0]?.message?.content || '';
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { intent: 'chat' };
    const parsed = JSON.parse(jsonMatch[0]);
    const taskSpec = parsed.taskSpec || {};
    return {
      intent: parsed.intent || 'chat',
      scope: parsed.scope || currentScope || 'root',
      taskSpec,
      translatedMessage: taskSpec.description || parsed.translatedMessage || message,
      confirmation: parsed.confirmation || '',
      needsConfirmation: parsed.needsConfirmation !== false,
      confirmationMessage: parsed.confirmationMessage || '',
      isHighRisk: parsed.isHighRisk !== false,
    };
  } catch (classifyErr) {
    console.error('classifyAndTranslate failed — fallback to chat intent:', classifyErr.message);
    return { intent: 'chat' };
  }
}

// สร้าง Technical Action Plan สำหรับ Pro — dense, scannable, Pro read_file ถูกจุดรอบแรก
// รองรับ schema ใหม่ {path, fn}[] และ schema เก่า string[] ใน files_hint
function buildTaskBrief(classified, originalMessage) {
  const { taskSpec = {} } = classified;

  const task = taskSpec.description || originalMessage;
  const targetBehavior = taskSpec.target_behavior || '';
  const constraints = Array.isArray(taskSpec.logic_constraints) ? taskSpec.logic_constraints
    : (Array.isArray(taskSpec.business_rules) ? taskSpec.business_rules : []);
  const filesRaw = Array.isArray(taskSpec.files_hint) ? taskSpec.files_hint : [];
  const diffExp = taskSpec.diff_expectation || taskSpec.expected_change || '';

  // normalize: string → {path, fn:''}
  const files = filesRaw.map(f => typeof f === 'string' ? { path: f, fn: '' } : f);

  let brief = `🎯 **งาน:** ${task}`;

  if (targetBehavior) {
    brief += `\n\n▸ **Target Behavior:**\n${targetBehavior}`;
  }

  if (constraints.length) {
    brief += `\n\n▸ **Logic Constraints:**\n${constraints.map(c => `• ${c}`).join('\n')}`;
  }

  if (files.length) {
    const fileLines = files.map(f => f.fn ? `• \`${f.path}\` → ${f.fn}` : `• \`${f.path}\``);
    brief += `\n\n▸ **ไฟล์เป้าหมาย:**\n${fileLines.join('\n')}`;
  }

  if (diffExp) {
    brief += `\n\n▸ **สิ่งที่ต้องเปลี่ยน:** ${diffExp}`;
  }

  return brief;
}

module.exports = { normalizeThai, detectQuickTrigger, isCodeMetricsQuery, classifyAndTranslate, buildTaskBrief };
