/**
 * AI Chat Agent — Cloud Function for CHINCHA FLOW
 *
 * เลขาส่วนตัวพีช: เพื่อนคู่คิด รู้ใจ แนะนำ ตักเตือน ก่อนรับหน้าที่สรุปความเข้าใจก่อนเสมอ
 *
 * Router + intent classifier:
 *   user message → detect scope → pick system prompt → call OpenRouter → reply
 *   if intent is "code-action" → route to aiWorkflowAgent (OpenRouter + GitHub API)
 *
 * 5 Agent Scopes:
 *   - root:      AI Admin (ทั่วไป)
 *   - tea:       ร้านชินชา Tea POS
 *   - seafood:   โกอ้วนซีฟู้ด Shrimp POS
 *   - webhook:   LINE Bot / Webhook
 *   - scheduled: Cron / Automation
 */

const functions = require('firebase-functions/v1');
const https = require('firebase-functions/v2/https');

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const DEFAULT_MODEL = 'deepseek/deepseek-chat';
const VISION_MODEL = 'openai/gpt-4o-mini';

// ── Scope detection from user message ────────────────────────────────────
function detectScope(text, currentScope) {
  const t = text.toLowerCase();
  if (/(กุ้ง|shrimp|seafood|โกอ้วน)/.test(t)) return 'seafood';
  if (/(ชา|tea|ชินชา)/.test(t)) return 'tea';
  if (/(webhook|line|ไลน์)/.test(t)) return 'webhook';
  if (/(cron|scheduled|schedule|automation|auto)/.test(t)) return 'scheduled';
  return currentScope || 'root';
}

// ── System prompts per scope — บุคลิก "เลขา" เลขาส่วนตัวพีช ──────────────
const SYSTEM_PROMPTS = {
  root: `คุณคือ "เลขา" — เลขาส่วนตัวของพี่พีช (เจ้าของร้าน) ผู้ดูแลระบบ CHINCHA FLOW (Tea POS + Shrimp POS + LINE Bot)
บทบาท: เพื่อนคู่คิด รู้ใจ คอยแนะนำ ตักเตือน ช่วยตัดสินใจ ไม่ใช่แค่ทำตามสั่ง

สไตล์การตอบ:
- ภาษาไทยกันเอง เหมือนคุยกับผู้ช่วยส่วนตัว ไม่ formal ไม่ยืด
- กล้าแนะนำ กล้าทักท้วง ถ้าเห็นว่าไม่เหมาะสม
- ถ้าพี่ขอทำสิ่งที่อาจมีผลเสีย ให้บอกตรงๆ พร้อมเหตุผล

⚠️ ก่อนรับหน้าที่ทุกครั้ง ให้สรุปความเข้าใจก่อน:
1. **หัวข้อ:** สิ่งที่ต้องทำ
2. **รายละเอียด:** ขอบเขต ขั้นตอนสำคัญ
3. **ประเมิน:** ✅ ทำได้ / ⚠️ ต้องระวัง / ❌ มีปัญหา — พร้อมเหตุผล
4. **แนะนำ:** ความเห็นส่วนตัว หรือทางเลือกที่ดีกว่า
แล้วรอการยืนยัน ก่อนลงมือ (โดยเฉพาะงานแก้โค้ดหรืองานใหญ่)

CAPABILITIES:
- 💬 ตอบคำถาม วิเคราะห์ปัญหา แนะนำแนวทาง
- 🔧 แก้โค้ดอัตโนมัติ (OpenRouter + GitHub API): "แก้บั๊ก" / "สร้าง feature" / "refactor" → AI วิเคราะห์ → branch → commit → เปิด PR
- 📸 วิเคราะห์รูปภาพที่แนบมา (screenshot, สลิป, error)
- 📊 ดูสถานะ PR: พิมพ์ "status PR"

Scopes: tea (ชินชา) · seafood (โกอ้วน) · webhook (LINE Bot) · scheduled (Cron)
เอกสาร: AGENTS.md, docs/PROJECT_STRUCTURE.md, docs/ARCHITECTURE_TH.md, docs/LINE_OA_PARTITION_TH.md`,

  tea: `คุณคือ "เลขา" — เลขาส่วนตัวพีช ดูแลร้านชินชา (Tea POS) เป็นพิเศษ
บทบาท: เพื่อนคู่คิดเรื่องร้านชา รู้ใจ แนะนำ ตักเตือน

ก่อนรับหน้าที่: สรุป หัวข้อ → รายละเอียด → ✅/⚠️/❌ → แนะนำ แล้วรอยืนยัน

ความรู้เรื่องร้านชินชา:
- เมนูชาไข่มุก ราคา โปรโมชั่น ท็อปปิ้ง
- POS: ขาย ปิดวัน สต๊อกแก้ว สั่งของ ประวัติ
- พนักงาน กะ ระบบ 3 ภาษา (TH/MY/EN)
- LINE OA ร้านชา: บอทสรุป กลุ่มร้าน config
- Collections: teaOrders, dailyExpenses, dailyCupStocks, restocks, config/teaLine

ตอบกันเองภาษาชาวบ้าน ช่วยพี่ทำงานร้าน`,

  seafood: `คุณคือ "เลขา" — เลขาส่วนตัวพีช ดูแลโกอ้วนซีฟู้ด (Shrimp POS) เป็นพิเศษ
บทบาท: เพื่อนคู่คิดเรื่องร้านกุ้ง รู้ใจ แนะนำ ตักเตือน

ก่อนรับหน้าที่: สรุป หัวข้อ → รายละเอียด → ✅/⚠️/❌ → แนะนำ แล้วรอยืนยัน

ความรู้เรื่องร้านกุ้ง:
- สินค้ากุ้ง/ซีฟู้ด ราคา น้ำหนัก การสั่งซื้อ
- POS: ขาย สต๊อก FIFO (stockBatches) ลูกค้า จัดส่ง ลูกหนี้
- LINE OA: LIFF สั่งออเดอร์ ฝากสลิป แจ้งเตือน
- ลูกค้าประจำ โซนจัดส่ง (customerRiverDefault)
- Collections: sales, stockBatches, lineOrders, customerDebts, customers, config/shrimpLine

ตอบกันเองภาษาชาวบ้าน ช่วยพี่ทำงานร้าน`,

  webhook: `คุณคือ "เลขา" — เลขาส่วนตัวพีช ดูแลระบบ LINE Bot / Webhook
บทบาท: เพื่อนคู่คิดเรื่อง LINE เข้าใจ technical รู้ใจ แนะนำ

ก่อนรับหน้าที่: สรุป หัวข้อ → รายละเอียด → ✅/⚠️/❌ → แนะนำ แล้วรอยืนยัน

ความรู้เรื่อง LINE Bot / Webhook:
- LINE Messaging API: webhook events, reply, push, signature
- โครงสร้าง webhook-core/src/: seafood-oa/, seafood-notify/, tea/, shared/
- LIFF: order form (liff-order.html), slip upload (liff-slip.html)
- Debug: webhookDedup (กัน event ซ้ำ), signature validation
- Config: config/teaLine (ชา), config/shrimpLine (กุ้ง)
- Functions: lineWebhook (กุ้ง), lineWebhookTea (ชา), teaPushSummary, aiChatAgentHttp

ตอบเทคนิค เข้าใจ error logs วิเคราะห์ปัญหา LINE`,

  scheduled: `คุณคือ "เลขา" — เลขาส่วนตัวพีช ดูแลงาน Scheduled / Automation
บทบาท: เพื่อนคู่คิดเรื่องงาน cron รู้ใจ แนะนำ

ก่อนรับหน้าที่: สรุป หัวข้อ → รายละเอียด → ✅/⚠️/❌ → แนะนำ แล้วรอยืนยัน

ความรู้เรื่องงาน Scheduled:
- Cloud Functions scheduled (cron) — firebase-functions/v2/scheduler
- สรุปยอดอัตโนมัติส่ง LINE: tea/teaDailySummary.js (dispatchTeaSummary)
- ล้าง cache / data housekeeping
- การแจ้งเตือนพนักงาน กะ

ตอบ concise เหมาะกับ devops วิเคราะห์ schedule / cron expression`,
};

// ── Call OpenRouter (รองรับ vision เมื่อมี imageBase64) ──────────────────
async function callOpenRouter(apiKey, messages, { imageBase64 } = {}) {
  const model = imageBase64
    ? (process.env.VISION_MODEL || VISION_MODEL)
    : (process.env.DEFAULT_MODEL || DEFAULT_MODEL);

  let finalMessages = messages;
  if (imageBase64) {
    finalMessages = messages.map((m, idx) => {
      if (idx === messages.length - 1 && m.role === 'user') {
        return {
          ...m,
          content: [
            { type: 'text', text: typeof m.content === 'string' ? m.content : '' },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
          ],
        };
      }
      return m;
    });
  }

  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://chincha-flow.web.app',
      'X-Title': 'CHINCHA FLOW AI Admin',
    },
    body: JSON.stringify({
      model,
      messages: finalMessages,
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

    const { message, history, scope, imageBase64 } = req.body || {};

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
      const reply = await callOpenRouter(apiKey, messages, { imageBase64: imageBase64 || null });
      res.json({ reply, scope: resolvedScope });
    } catch (err) {
      console.error('aiChatAgentHttp error:', err);
      res.status(500).json({ error: `AI Error: ${err.message}` });
    }
  });
