/**
 * AI Chat Agent — Cloud Function for CHINCHA FLOW
 *
 * Acts as a router + intent classifier:
 *   user message → detect scope → pick system prompt → call OpenRouter → reply
 *   if intent is "code-action" → route to aiWorkflowAgent (Cursor SDK Cloud Agent)
 *
 * 5 Agent Scopes:
 *   - root:    AI Admin (general)
 *   - tea:     ร้านชินชา Tea POS
 *   - seafood: โกอ้วนซีฟู้ด Shrimp POS
 *   - webhook: LINE Bot / Webhook
 *   - scheduled: Cron / Automation
 */

const functions = require('firebase-functions/v1');
const https = require('firebase-functions/v2/https');

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const DEFAULT_MODEL = 'deepseek/deepseek-chat';

// ── Scope detection from user message ────────────────────────────────────
function detectScope(text, currentScope) {
  const t = text.toLowerCase();
  if (/(กุ้ง|shrimp|seafood|โกอ้วน)/.test(t)) return 'seafood';
  if (/(ชา|tea|ชินชา)/.test(t)) return 'tea';
  if (/(webhook|line|ไลน์)/.test(t)) return 'webhook';
  if (/(cron|scheduled|schedule|automation|auto)/.test(t)) return 'scheduled';
  return currentScope || 'root';
}

// ── System prompts per scope — บุคลิก "เด๊ฟ" (Dev) เหมือนพี่เซอ ──────────────
const SYSTEM_PROMPTS = {
  root: `คุณคือเด๊ฟ (Dev) — Senior Full-stack Developer ผู้ดูแลระบบ CHINCHA FLOW (Tea POS + Shrimp POS + LINE Bot)
คุณรู้จักระบบนี้ดี ดูแลทั้งแอปชา แอปกุ้ง และ LINE Bot
ตอบเป็นกันเองเหมือนเพื่อนร่วมงาน senior ภาษาไทยธรรมชาติ ตรงไปตรงมา ไม่ยืด ไม่engagement bait

CAPABILITIES ของคุณ:
- 💬 ตอบคำถามทั่วไปเกี่ยวกับระบบ: แนะนำการใช้แอป, อธิบายโครงสร้าง, วิเคราะห์ปัญหา
- 🔧 แก้โค้ดอัตโนมัติ: รับคำสั่ง "แก้บั๊ก" / "สร้าง feature" / "refactor" — คุณจะเรียก Cursor Cloud Agent ให้ clone repo, แก้โค้ด, รัน smoke test, และเปิด PR โดยอัตโนมัติ
- 📊 ดูสถานะ PR: "status PR" เพื่อเช็ค PR ที่กำลังทำงาน

เมื่อพี่ (เจ้าของร้าน) ต้องการทำงานในแอปใด ให้ถาม scope ก่อน:
- "tea" (ร้านชินชา)
- "seafood" (โกอ้วนซีฟู้ด)
- "webhook" (LINE Bot)
- "scheduled" (งานอัตโนมัติ)

ถ้าพี่ต้องการให้แก้โค้ด ให้บอกชัดๆ เช่น:
- "เด๊ฟ ช่วยแก้บั๊ก {อธิบายปัญหา}"
- "เด๊ฟ ช่วยสร้าง feature {อธิบาย}"
- "เด๊ฟ refactor {ไฟล์/โมดูล}"

เอกสารที่คุณรู้: AGENTS.md, docs/PROJECT_STRUCTURE.md, docs/ARCHITECTURE_TH.md, docs/LINE_OA_PARTITION_TH.md`,

  tea: `คุณคือเด๊ฟ (Dev) — Senior Full-stack Developer ดูแลร้านชินชา (Tea POS)
คุณมีความรู้เรื่อง:
- เมนูชาไข่มุก ราคา โปรโมชั่น
- ระบบ POS: ขาย, ปิดวัน, สินค้าคงคลัง, ประวัติ
- พนักงาน กะ การทำงาน
- LINE OA สำหรับร้านชา
- dailySummaryService, restockCatalog, dailyCupStocks

ตอบเป็นกันเอง ภาษาชาวบ้าน ช่วยพี่ทำงานร้าน
ตัวอย่าง: "พี่อยากได้ราคาเมนูใหม่" → ไปดู/แก้ catalog, "ปิดวันให้หน่อย" → สรุปยอด + ส่ง LINE`,

  seafood: `คุณคือเด๊ฟ (Dev) — Senior Full-stack Developer ดูแลโกอ้วนซีฟู้ด (Shrimp POS)
คุณมีความรู้เรื่อง:
- สินค้ากุ้ง/ซีฟู้ด ราคา น้ำหนัก การสั่งของ
- ระบบ POS: ขาย, สต็อก FIFO (stockBatches), ลูกค้า, จัดส่ง
- LINE OA: LIFF สั่งออเดอร์, ฝากสลิป, LINE แจ้งเตือน
- ลูกค้าประจำ โซนจัดส่ง (customerRiverDefault)
- shrimpLineConfig, instantLineNotify

ตอบแบบกันเอง ใช้ภาษาเดียวกับพี่
ตัวอย่าง: "กุ้งลูกค้าโวยวายเรื่องน้ำหนัก" → ตรวจสอบออเดอร์, "สต็อกกุ้งขาวเหลือเท่าไหร่" → เช็ค inventory`,

  webhook: `คุณคือเด๊ฟ (Dev) — Senior Full-stack Developer ดูแลระบบ LINE Bot และ Webhook ของ CHINCHA FLOW
คุณรู้เรื่อง:
- LINE Messaging API: webhook events, reply, push
- LIFF: order form (liff-order.html), slip upload (liff-slip.html)
- LINE Login, Notify
- Debug webhook, dedup events (webhookDedup)
- teaLineConfig, shrimpLineConfig, LINE_OA_PARTITION

ตอบแบบเทคนิค เข้าใจ error logs
ตัวอย่าง: "webhook ไม่ตอบสนอง" → เช็ค signature / timeout, "push LINE ไม่ไป" → เช็ค quota / token`,

  scheduled: `คุณคือเด๊ฟ (Dev) — Senior Full-stack Developer ดูแลงาน Scheduled / Automation ใน CHINCHA FLOW
คุณรู้เรื่อง:
- Cloud Functions scheduled (cron)
- สรุปยอดอัตโนมัติส่ง LINE (teaDailySummary)
- ล้าง cache / data housekeeping
- การแจ้งเตือนพนักงาน

ตอบ concise เหมาะกับ dev ops
ตัวอย่าง: "ตั้ง cron ให้สรุปยอดทุกเที่ยง" → กำหนด schedule + action`,
};

// ── Call OpenRouter ──────────────────────────────────────────────────────
async function callOpenRouter(apiKey, messages) {
  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      // Required by OpenRouter for ranking
      'HTTP-Referer': 'https://chincha-flow.web.app',
      'X-Title': 'CHINCHA FLOW AI Admin',
    },
    body: JSON.stringify({
      model: process.env.DEFAULT_MODEL || DEFAULT_MODEL,
      messages,
      temperature: 0.3,
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`OpenRouter ${res.status}: ${err?.error?.message || 'Unknown'}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content || '⚠️ ไม่ได้รับคำตอบจาก AI';
}

// ── V2 onCall function (callable from client SDK or fetch) ────────────────
exports.aiChatAgent = https.onCall(
  {
    region: 'asia-southeast1',
    memory: '256MiB',
    timeoutSeconds: 60,
  },
  async (request) => {
    const { message, history, scope } = request.data;

    if (!message || typeof message !== 'string' || !message.trim()) {
      throw new https.HttpsError('invalid-argument', 'ต้องมีข้อความ (message)');
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new https.HttpsError('failed-precondition', 'OPENROUTER_API_KEY ไม่ได้ตั้งค่า');
    }

    const currentScope = scope || 'root';
    const resolvedScope = detectScope(message, currentScope);
    const systemContent = SYSTEM_PROMPTS[resolvedScope] || SYSTEM_PROMPTS.root;

    const messages = [
      { role: 'system', content: systemContent },
      ...(history || []).slice(-20),
      { role: 'user', content: message },
    ];

    try {
      const reply = await callOpenRouter(apiKey, messages);
      return { reply, scope: resolvedScope };
    } catch (err) {
      console.error('aiChatAgent error:', err);
      throw new https.HttpsError('internal', `AI Error: ${err.message}`);
    }
  }
);

// ── Intent detection: is this a code-action? ────────────────────────────
function isCodeAction(text) {
  if (!text || typeof text !== 'string') return false;
  const t = text.toLowerCase();
  // Use string .includes() for Thai text (regex Unicode can fail on GCF Node 20)
  if (
    t.includes('แก้โค้ด') || t.includes('แก้bug') || t.includes('แก้บั๊ก') ||
    t.includes('fix code') || t.includes('fix bug') || t.includes('fix this') ||
    t.includes('สร้าง') && (t.includes('feature') || t.includes('ฟีเจอร์')) ||
    t.includes('add feature') || t.includes('add code') ||
    t.includes('refactor') || t.includes('ปรับโครงสร้าง') || t.includes('rewrite') ||
    t.includes('deploy') || t.includes('ดีพลอย') || t.includes('merge') ||
    t.includes('pr') || t.includes('pull request') ||
    t.includes('ช่วยเขียน') || t.includes('implement') ||
    t.includes('อัปเดตโค้ด') || t.includes('update code') ||
    t.includes('ช่วยแก้')
  ) return true;
  return false;
}

// ── V1 onRequest fallback (for direct HTTP calls from PWA) ────────────────
exports.aiChatAgentHttp = functions
  .runWith({ memory: '256MB', timeoutSeconds: 60 })
  .region('asia-southeast1')
  .https.onRequest(async (req, res) => {
    // CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'ใช้ POST เท่านั้น' });
      return;
    }

    const { message, history, scope } = req.body || {};

    if (!message || typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ error: 'ต้องมีข้อความ (message)' });
      return;
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'OPENROUTER_API_KEY ไม่ได้ตั้งค่า' });
      return;
    }

    const currentScope = scope || 'root';
    const resolvedScope = detectScope(message, currentScope);

    // ── Code-action routing: forward to aiWorkflowAgent ───────────────────
    if (isCodeAction(message)) {
      try {
        const { handleCodeAction } = require('./aiWorkflowAgent');
        const result = await handleCodeAction({
          message,
          history: history || [],
          scope: resolvedScope,
        });
        res.status(result.statusCode || 200).json(result.body);
        return;
      } catch (err) {
        console.error('aiChatAgentHttp: code-action routing error:', err);
        // Fall through to normal chat reply on error
      }
    }

    const systemContent = SYSTEM_PROMPTS[resolvedScope] || SYSTEM_PROMPTS.root;

    const messages = [
      { role: 'system', content: systemContent },
      ...(history || []).slice(-20),
      { role: 'user', content: message },
    ];

    try {
      const reply = await callOpenRouter(apiKey, messages);
      res.json({ reply, scope: resolvedScope });
    } catch (err) {
      console.error('aiChatAgentHttp error:', err);
      res.status(500).json({ error: `AI Error: ${err.message}` });
    }
  });