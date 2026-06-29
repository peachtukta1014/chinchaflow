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

// รับภาษาชาวบ้านจากพีช → วิเคราะห์ → สร้าง structured Task Brief ส่งให้ Pro
async function classifyAndTranslate(apiKey, message, history, currentScope) {
  const systemPrompt = `คุณคือจีจี้ — เลขาส่วนตัวพีช วิเคราะห์คำสั่งภาษาชาวบ้านแล้วแปลเป็น Task Brief ให้ Pro Developer ทำงานได้ตรงจุด

CHINCHA FLOW scopes:
- ร้านชินชา/ชา/chincha-tea (scope: tea) — apps/chincha-tea/, POS ขายชา, สต๊อกแก้ว, พนักงาน, LINE บอทชา
- โกอ้วนซีฟู้ด/ร้านกุ้ง/seafood (scope: seafood) — apps/seafood-pos/, POS ขายกุ้ง, สต๊อก FIFO, ลูกค้า, LINE LIFF
- LINE Bot/webhook (scope: webhook) — apps/webhook-core/, บอทกลุ่ม, webhook events, Cloud Functions
- ทั่วไป/หลายส่วน (scope: root)

วิเคราะห์ว่าพี่พีชต้องการ "แก้/เพิ่ม/อ่านโค้ดจริง" หรือ "คุยทั่วไป/ถามความเห็น" แล้วตอบ JSON เท่านั้น:

กรณี code-action (แก้/เพิ่ม/ดูโค้ดจริง):
{
  "intent": "code-action",
  "scope": "tea|seafood|webhook|root",
  "taskSpec": {
    "description": "[1 ประโยค: แก้/เพิ่มอะไร ที่ function/component ไหน]",
    "files_hint": ["apps/.../ไฟล์หลักที่แก้", "apps/.../ไฟล์อ่านประกอบถ้ามี"],
    "expected_change": "[1 บรรทัด: logic/ค่า/condition ที่เปลี่ยน — เจาะจงที่สุด]",
    "business_rules": ["กฎสำคัญที่ต้องรักษา — ใส่เฉพาะที่เกี่ยวจริงๆ"]
  },
  "confirmation": "[สรุปสั้น 1 ประโยค]",
  "needsConfirmation": true,
  "confirmationMessage": "[ดูรูปแบบด้านล่าง — ใส่เฉพาะเมื่อ needsConfirmation=true]",
  "isHighRisk": true
}

กฎ files_hint — ระบุชื่อไฟล์จริง ไม่ใช่แค่โฟลเดอร์:
- files_hint[0] = ไฟล์หลักที่ต้องแก้ (path เต็ม เช่น apps/seafood-pos/src/utils/pricing.js)
- files_hint[1-2] = ไฟล์อ่านประกอบ (Pro จะ read_file เอง ถ้าจำเป็น)
- seafood: apps/seafood-pos/src/utils/, src/services/, src/lib/, src/screens/, src/liff/
- tea: apps/chincha-tea/src/lib/, src/services/, src/screens/, src/components/
- webhook: apps/webhook-core/src/ (aiChatAgent.js, aiWorkflowAgent.js, seafood-oa/, tea/)
- ถ้าไม่แน่ใจ ใส่ไฟล์ที่น่าจะเกี่ยวที่สุด 1 ไฟล์

กฎ business_rules — ใส่เฉพาะที่เกี่ยวกับงานนี้จริงๆ:
- seafood: ราคา/คำนวณเงิน → "ราคาต้องไม่ติดลบ, ห้ามแตะ FIFO logic ใน saleFifo.js"
- tea: สต๊อก → "ห้ามแตะ dailyCupStocks โดยตรงนอกจาก inventoryService.js"
- ถ้าไม่มีกฎพิเศษ → []

กฎ needsConfirmation:
- true เสมอ (Flash ต้องสรุปงานให้พีชยืนยันก่อนส่งโปรทุกครั้ง)
- ยกเว้นเมื่อ message มี "ไฟเขียว" — แต่กรณีนี้ backend จัดการเอง ไม่ต้องใส่ใน JSON

กฎ isHighRisk:
- true: ราคา/VAT/ส่วนลด, FIFO (stockBatches), lineOrders, lineUserId/roles, Firestore schema, auth/uid, flow POS หลัก, แก้ >3 ไฟล์
- false: ข้อความ/typo, UI สี/icon/layout, log/comment/doc, เพิ่ม UI เล็กๆ

รูปแบบ confirmationMessage (technical + กันเอง — Flash ต้องแปลเป็นภาษา developer ให้ชัด):
"📋 จีจี้อ่านโค้ดและเข้าใจแล้วนะครับพี่\\n\\n✅ จะทำ: [สิ่งที่จะทำ — ระบุ function/component/logic เจาะจง]\\n📁 ไฟล์ที่แตะ: [ชื่อไฟล์จริง + บรรทัดหรือ section ถ้ารู้]\\n⚠️ ความเสี่ยง: [low/medium/high — เหตุผลสั้นๆ]\\n❌ ไม่แตะ: [สิ่งที่จะไม่แตะ — business rules ที่รักษา]\\n\\n[💡 ถ้าเห็นแนวทางที่ดีกว่า หรือข้อควรระวังพิเศษ — แจ้งตรงๆ]\\n\\nพิมพ์ \\"ไฟเขียว\\" เพื่อส่งงานให้ V4-Pro ได้เลยครับ 🟢"

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

// สร้าง compact Task Brief สำหรับ Pro — Flash ย่อบริบทจากพีชเป็น 4-5 บรรทัด
// Pro มีโค้ดครบในตัวอยู่แล้ว (repo checkout) — ไม่ต้อง preload snippet
function buildTaskBrief(classified, originalMessage) {
  const { taskSpec = {} } = classified;

  const task = taskSpec.description || originalMessage;
  const change = taskSpec.expected_change || '';
  const files = Array.isArray(taskSpec.files_hint) ? taskSpec.files_hint : [];
  const rules = Array.isArray(taskSpec.business_rules) ? taskSpec.business_rules : [];

  const mainFile = files[0] ? `\`${files[0]}\`` : '(สำรวจเองจาก scope)';
  const extraFiles = files.slice(1).map(f => `\`${f}\``).join(', ');

  let brief = `**งาน:** ${task}`;
  if (change && change !== task) brief += ` — ${change}`;
  brief += `\n**ไฟล์:** ${mainFile}`;
  if (extraFiles) brief += `\n**อ่านก่อน:** ${extraFiles}`;
  if (rules.length) brief += `\n**กฎ:** ${rules.join(' · ')}`;

  return brief;
}

module.exports = { normalizeThai, detectQuickTrigger, isCodeMetricsQuery, classifyAndTranslate, buildTaskBrief };
