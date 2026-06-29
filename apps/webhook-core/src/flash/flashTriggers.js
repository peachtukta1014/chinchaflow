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
    "description": "[อธิบายงาน technical: ส่วนไหนของระบบ, พฤติกรรมที่ต้องการ, ปัญหาที่เกิด]",
    "files_hint": ["apps/.../ไฟล์ที่น่าจะต้องแก้", "..."],
    "expected_change": "[อธิบายให้ชัดว่าโค้ดควรเปลี่ยนยังไง ฟังก์ชันไหน ค่าอะไร]",
    "business_rules": ["กฎที่ Pro ต้องรักษา เช่น ห้ามแตะ FIFO", "ราคาต้องไม่ติดลบ"]
  },
  "confirmation": "[สรุปสั้น 1 ประโยค]",
  "needsConfirmation": true,
  "confirmationMessage": "[ดูรูปแบบด้านล่าง — ใส่เฉพาะเมื่อ needsConfirmation=true]",
  "isHighRisk": true
}

กฎ files_hint — ต้องระบุให้ถูกต้อง:
- seafood: apps/seafood-pos/src/utils/, src/services/, src/lib/, src/screens/, src/liff/
- tea: apps/chincha-tea/src/lib/, src/services/, src/screens/, src/components/
- webhook: apps/webhook-core/src/ (aiChatAgent.js, aiWorkflowAgent.js, seafood-oa/, tea/)
- ถ้าไม่แน่ใจ ใส่ไฟล์ที่น่าจะเกี่ยวที่สุด 1-3 ไฟล์

กฎ business_rules — ใส่เฉพาะที่เกี่ยวกับงานนี้จริงๆ:
- seafood: ราคา/คำนวณเงิน → "ราคาต้องไม่ติดลบ, ห้ามแตะ FIFO logic ใน saleFifo.js"
- tea: สต๊อก → "ห้ามแตะ dailyCupStocks โดยตรงนอกจาก inventoryService.js"
- ถ้าไม่มีกฎพิเศษ → []

กฎ needsConfirmation:
- false ถ้า message มีคำ: "ทำเลย" "ได้เลย" "ยืนยัน" "เปิด PR" "จัดการเลย" "โอเคทำ" "ตกลงทำ" หรือ history แสดงว่าพีชยืนยันแล้ว
- true ถ้าคำสั่งไม่ชัด ซับซ้อน หรือกระทบหลายส่วน

กฎ isHighRisk:
- true: ราคา/VAT/ส่วนลด, FIFO (stockBatches), lineOrders, lineUserId/roles, Firestore schema, auth/uid, flow POS หลัก, แก้ >3 ไฟล์
- false: ข้อความ/typo, UI สี/icon/layout, log/comment/doc, เพิ่ม UI เล็กๆ

รูปแบบ confirmationMessage (กันเอง เหมือนคุยกับเพื่อน):
"จีจี้เข้าใจแล้วนะครับ:\\n✅ ทำ: [สิ่งที่จะทำ]\\n❌ ไม่ทำ: [สิ่งที่จะไม่แตะ]\\n\\nถูกต้องไหมครับพี่? พิมพ์ \\"ทำเลย\\" ยืนยันได้เลย 🙂"

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

// สร้าง structured Task Brief สำหรับ Pro — Pro รับ brief นี้เป็น "message"
// hard cap 8,000 chars เพื่อไม่เกิน GitHub client_payload 10KB limit
const BRIEF_MAX_CHARS = 8000;

function buildTaskBrief(classified, originalMessage, fileContents = {}) {
  const { taskSpec = {}, confirmation } = classified;
  const filesHint = Array.isArray(taskSpec.files_hint) && taskSpec.files_hint.length
    ? taskSpec.files_hint.map(f => `- ${f}`).join('\n')
    : '- (Pro ต้องสำรวจเองจาก scope)';
  const rules = Array.isArray(taskSpec.business_rules) && taskSpec.business_rules.length
    ? taskSpec.business_rules.map(r => `- ${r}`).join('\n')
    : '- ปฏิบัติตาม AGENTS.md';

  const preloadedEntries = Object.entries(fileContents).filter(([, v]) => v);
  const hasPreloaded = preloadedEntries.length > 0;

  const coreSection = `## 📋 Task Brief (สร้างโดย Flash)

**งานที่ต้องทำ:**
${taskSpec.description || confirmation || originalMessage}

**ผลลัพธ์ที่คาดหวัง:**
${taskSpec.expected_change || '(วิเคราะห์จากโค้ดจริง)'}

**กฎ Business ที่ต้องรักษา:**
${rules}

**ไฟล์ที่เกี่ยว:**
${filesHint}
${hasPreloaded ? '→ Flash อ่านล่วงหน้าแล้ว — ดูโค้ดด้านล่าง ไม่ต้อง read_file ซ้ำ' : '→ Flash ไม่ได้ preload — Pro ต้อง read_file ก่อนแก้'}

**คำสั่งต้นฉบับจากพีช:**
"${originalMessage}"`;

  if (!hasPreloaded) return coreSection;

  // แจก budget ที่เหลือให้โค้ด preload — ตัดสั้นถ้าเกิน cap
  const budget = BRIEF_MAX_CHARS - coreSection.length - 60;
  if (budget <= 200) return coreSection; // core ยาวเกินไป ตัด preload ออก

  const perFile = Math.floor(budget / preloadedEntries.length);
  let preloadedSection = '\n\n**โค้ดที่ Flash อ่านล่วงหน้า:**';
  for (const [path, content] of preloadedEntries) {
    const maxLen = Math.max(perFile - 60, 100);
    const snippet = content.slice(0, maxLen);
    const truncated = content.length > maxLen ? '\n...(ตัดบางส่วน)' : '';
    preloadedSection += `\n\n--- ${path} ---\n\`\`\`\n${snippet}${truncated}\n\`\`\``;
  }

  return coreSection + preloadedSection;
}

module.exports = { normalizeThai, detectQuickTrigger, isCodeMetricsQuery, classifyAndTranslate, buildTaskBrief };
