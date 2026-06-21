/**
 * AI Chat Agent — Cloud Function for CHINCHA FLOW
 *
 * จีจี้ เลขาส่วนตัวพีช: เพื่อนคู่คิด รู้ใจ แนะนำ ตักเตือน ก่อนรับหน้าที่สรุปความเข้าใจก่อนเสมอ
 *
 * Model selection (3-tier):
 *   🟢 Flash (deepseek-v4-flash)  — แชททั่วไป
 *   🟡 Pro   (deepseek-v4-pro)    — โค้ด / วิเคราะห์ complex
 *   🔵 Vision (gpt-4o-mini)       — มีรูปแนบ
 *
 * Router + intent classifier:
 *   user message → detect scope → pickModel → call OpenRouter → reply
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
const { writeProgress, clearProgress, readProgress } = require('./shared/progressTracker');

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const FLASH_MODEL = 'deepseek/deepseek-v4-flash';   // แชททั่วไป — ถูก เร็ว
const PRO_MODEL   = 'deepseek/deepseek-v4-pro';     // โค้ด / วิเคราะห์ complex
const VISION_MODEL = 'openai/gpt-4o-mini';           // มีรูปแนบ

const GH_API  = 'https://api.github.com';
const GH_REPO = 'peachtukta1014/chinchaflow';

// ── Cache สำหรับ project docs (TTL 10 นาที) ──────────────────────────────
let _docsCache = null;
let _docsCacheTime = 0;
const DOCS_TTL_MS = 10 * 60 * 1000;

// ── ตรวจว่าถามเรื่อง code metrics ──────────────────────────────────────────
function isCodeMetricsQuery(text) {
  const t = (text || '').toLowerCase();
  return /(นับบรรทัด|กี่บรรทัด|code metric|metrics|บรรทัดทั้งหมด|จำนวนบรรทัด|ความยาวโค้ด|โปรเจกต์ใหญ่แค่ไหน)/.test(t);
}

// ── อ่าน CODE_METRICS.md จาก GitHub ───────────────────────────────────────
async function fetchCodeMetrics(ghPat) {
  try {
    const res = await fetch(`${GH_API}/repos/${GH_REPO}/contents/docs/CODE_METRICS.md?ref=main`, {
      headers: {
        'Authorization': `token ${ghPat}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'CF-AI',
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Buffer.from(data.content, 'base64').toString('utf-8');
  } catch { return null; }
}

// ── Scope detection from user message ────────────────────────────────────
function detectScope(text, currentScope) {
  const t = text.toLowerCase();
  if (/(กุ้ง|shrimp|seafood|โกอ้วน|ร้านกุ้ง)/.test(t)) return 'seafood';
  if (/(ชา|tea|ชินชา|ร้านน้ำ|chincha|bubble)/.test(t)) return 'tea';
  if (/(webhook|line|ไลน์)/.test(t)) return 'webhook';
  if (/(cron|scheduled|schedule|automation|auto)/.test(t)) return 'scheduled';
  return currentScope || 'root';
}

// ── System prompts per scope — บุคลิก "จีจี้" เลขาส่วนตัวพีช ──────────────
const SYSTEM_PROMPTS = {
  root: `คุณคือ "จีจี้" — เลขาส่วนตัวของพี่พีช (เจ้าของร้าน) ผู้ดูแลระบบ CHINCHA FLOW (Tea POS + Shrimp POS + LINE Bot)
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

🔐 จีจี้มี GH_PAT (GitHub Admin token) พร้อมใช้งานเสมอ — สามารถแก้โค้ด สร้าง branch commit และเปิด PR ได้ทันทีโดยอัตโนมัติ ไม่ต้องรอพี่พีชอนุมัติหรือทำเองทุกขั้นตอน เหมาะสำหรับเวลาพี่ขับรถส่งกุ้งหรือยุ่งอยู่

Scopes: tea (ชินชา/ร้านน้ำ) · seafood (โกอ้วน/ร้านกุ้ง) · webhook (LINE Bot) · scheduled (Cron)
เอกสาร: AGENTS.md, docs/PROJECT_STRUCTURE.md, docs/ARCHITECTURE_TH.md, docs/LINE_OA_PARTITION_TH.md`,

  tea: `คุณคือ "จีจี้" — เลขาส่วนตัวพีช ดูแลร้านชินชา (Tea POS) เป็นพิเศษ
บทบาท: เพื่อนคู่คิดเรื่องร้านชา รู้ใจ แนะนำ ตักเตือน

ก่อนรับหน้าที่: สรุป หัวข้อ → รายละเอียด → ✅/⚠️/❌ → แนะนำ แล้วรอยืนยัน

ความรู้เรื่องร้านชินชา:
- เมนูชาไข่มุก ราคา โปรโมชั่น ท็อปปิ้ง
- POS: ขาย ปิดวัน สต๊อกแก้ว สั่งของ ประวัติ
- พนักงาน กะ ระบบ 3 ภาษา (TH/MY/EN)
- LINE OA ร้านชา: บอทสรุป กลุ่มร้าน config
- Collections: teaOrders, dailyExpenses, dailyCupStocks, restocks, config/teaLine

ตอบกันเองภาษาชาวบ้าน ช่วยพี่ทำงานร้าน`,

  seafood: `คุณคือ "จีจี้" — เลขาส่วนตัวพีช ดูแลโกอ้วนซีฟู้ด (Shrimp POS) เป็นพิเศษ
บทบาท: เพื่อนคู่คิดเรื่องร้านกุ้ง รู้ใจ แนะนำ ตักเตือน

ก่อนรับหน้าที่: สรุป หัวข้อ → รายละเอียด → ✅/⚠️/❌ → แนะนำ แล้วรอยืนยัน

ความรู้เรื่องร้านกุ้ง:
- สินค้ากุ้ง/ซีฟู้ด ราคา น้ำหนัก การสั่งซื้อ
- POS: ขาย สต๊อก FIFO (stockBatches) ลูกค้า จัดส่ง ลูกหนี้
- LINE OA: LIFF สั่งออเดอร์ ฝากสลิป แจ้งเตือน
- ลูกค้าประจำ โซนจัดส่ง (customerRiverDefault)
- Collections: sales, stockBatches, lineOrders, customerDebts, customers, config/shrimpLine

ตอบกันเองภาษาชาวบ้าน ช่วยพี่ทำงานร้าน`,

  webhook: `คุณคือ "จีจี้" — เลขาส่วนตัวพีช ดูแลระบบ LINE Bot / Webhook
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

  scheduled: `คุณคือ "จีจี้" — เลขาส่วนตัวพีช ดูแลงาน Scheduled / Automation
บทบาท: เพื่อนคู่คิดเรื่องงาน cron รู้ใจ แนะนำ

ก่อนรับหน้าที่: สรุป หัวข้อ → รายละเอียด → ✅/⚠️/❌ → แนะนำ แล้วรอยืนยัน

ความรู้เรื่องงาน Scheduled:
- Cloud Functions scheduled (cron) — firebase-functions/v2/scheduler
- สรุปยอดอัตโนมัติส่ง LINE: tea/teaDailySummary.js (dispatchTeaSummary)
- ล้าง cache / data housekeeping
- การแจ้งเตือนพนักงาน กะ

ตอบ concise เหมาะกับ devops วิเคราะห์ schedule / cron expression`,
};

// ── เลือก model จากประเภทงาน ─────────────────────────────────────────────
function pickModel(text, { imageBase64, images } = {}) {
  if (imageBase64 || (images && images.length > 0)) return process.env.VISION_MODEL || VISION_MODEL;
  if (isCodeRelated(text)) return process.env.CODE_MODEL || PRO_MODEL;
  return process.env.FLASH_MODEL || FLASH_MODEL;
}

// ── ตรวจว่าเกี่ยวกับโค้ด (กว้างกว่า isCodeAction — ครอบ "อธิบาย/วิเคราะห์" ด้วย) ──
function isCodeRelated(text) {
  if (!text || typeof text !== 'string') return false;
  const t = text.toLowerCase();
  return (
    // คำ tech ทั่วไป
    t.includes('โค้ด') || t.includes('code') || t.includes('บั๊ก') || t.includes('บัค') || t.includes('bug') ||
    t.includes('error') || t.includes('fix') || t.includes('refactor') ||
    t.includes('feature') || t.includes('ฟีเจอร์') ||
    t.includes('ฟังก์ชัน') || t.includes('function') || t.includes('component') ||
    t.includes('api') || t.includes('deploy') || t.includes('ดีพลอย') ||
    t.includes('import') || t.includes('export') || t.includes('logic') ||
    t.includes('implement') || t.includes('script') || t.includes('สคริปต์') ||
    t.includes('firestore') || t.includes('firebase') || t.includes('webhook') ||
    t.includes('pull request') || t.includes('branch') || t.includes('commit') || t.includes('merge') ||
    // "pr" เฉพาะ (ไม่ใช่ substring ของคำไทย)
    /\bpr\b/.test(t) ||
    // คำไทยที่เป็น action บน code/ระบบ
    t.includes('แก้โค้ด') || t.includes('แก้บั๊ก') || t.includes('แก้บัค') || t.includes('แก้ bug') ||
    t.includes('แก้ error') || t.includes('แก้ระบบ') || t.includes('แก้ไฟล์') ||
    t.includes('อัปเดตโค้ด') || t.includes('อัปเดตระบบ') || t.includes('update code') ||
    t.includes('เพิ่มฟีเจอร์') || t.includes('เพิ่มฟังก์ชัน') || t.includes('เพิ่ม feature') ||
    t.includes('สร้างฟีเจอร์') || t.includes('สร้างฟังก์ชัน') || t.includes('สร้าง feature') ||
    t.includes('อธิบายโค้ด') || t.includes('วิเคราะห์โค้ด') || t.includes('วิเคราะห์บั๊ก') || t.includes('วิเคราะห์ระบบ') ||
    t.includes('ไฟล์') && (t.includes('แก้') || t.includes('อ่าน') || t.includes('เปิด') || t.includes('ดู'))
  );
}

// ── Call OpenRouter (รองรับ vision เมื่อมี imageBase64 หรือ images[]) ─────
async function callOpenRouter(apiKey, messages, { imageBase64, images, text } = {}) {
  const model = pickModel(text || '', { imageBase64, images });

  let finalMessages = messages;
  const hasImages = imageBase64 || (images && images.length > 0);
  if (hasImages) {
    const imageItems = [];
    if (imageBase64) {
      imageItems.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } });
    }
    if (images && images.length > 0) {
      images.forEach(b64 => imageItems.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } }));
    }
    finalMessages = messages.map((m, idx) => {
      if (idx === messages.length - 1 && m.role === 'user') {
        return {
          ...m,
          content: [
            { type: 'text', text: typeof m.content === 'string' ? m.content : '' },
            ...imageItems,
          ],
        };
      }
      return m;
    });
  }

  // Pro → แม่นยำ ตอบยาว | Flash → เร็ว ตอบปานกลาง | Vision → อธิบายรูป
  const isProModel = model.includes('pro') || model.includes('v4-pro');
  const isVisionModel = model.includes('gpt-4o') || model.includes('vision');
  const maxTokens = isProModel ? 8192 : isVisionModel ? 1024 : 2048;
  const temperature = isProModel ? 0.15 : 0.3;

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
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`OpenRouter ${res.status}: ${err?.error?.message || 'Unknown'}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content || '⚠️ ไม่ได้รับคำตอบจาก AI';
}

// ── โหลด JIIJI.md — ตัวตนและ skills ของจีจี้ (cache เดียวกัน) ───────────
let _jiijiCache = null;
let _jiijiCacheTime = 0;

async function fetchJiijiDef(ghPat) {
  const now = Date.now();
  if (_jiijiCache && (now - _jiijiCacheTime) < DOCS_TTL_MS) return _jiijiCache;
  try {
    const res = await fetch(`${GH_API}/repos/${GH_REPO}/contents/JIIJI.md?ref=main`, {
      headers: { 'Authorization': `token ${ghPat}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'CF-AI' },
    });
    if (!res.ok) return '';
    const data = await res.json();
    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    _jiijiCache = content.slice(0, 2000);
    _jiijiCacheTime = now;
    return _jiijiCache;
  } catch { return ''; }
}

// ── โหลด project rules + Peach's style จาก GitHub (cache 10 นาที) ─────────
// อ่านทุก session แรก จากนั้น cache ไว้ไม่ต้องยิง GitHub ทุกข้อความ
async function fetchChatAgentDocs(ghPat) {
  const now = Date.now();
  if (_docsCache && (now - _docsCacheTime) < DOCS_TTL_MS) return _docsCache;

  const files = [
    { path: 'AGENTS.md', label: 'กฎ monorepo + กฎแต่ละแอป', maxLen: 3000 },
    { path: 'docs/PEACH_WORKING_STYLE_TH.md', label: 'สไตล์การทำงานของพี่พีช', maxLen: 2500 },
    { path: 'docs/AGENT_HANDBOOK_TH.md', label: 'คู่มือ agent + แผนที่ repo', maxLen: 1500 },
  ];

  let result = '';
  for (const f of files) {
    try {
      const res = await fetch(`${GH_API}/repos/${GH_REPO}/contents/${f.path}?ref=main`, {
        headers: {
          'Authorization': `token ${ghPat}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'CF-AI',
        },
      });
      if (!res.ok) continue;
      const data = await res.json();
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      result += `\n\n=== ${f.label} (${f.path}) ===\n${content.slice(0, f.maxLen)}\n`;
    } catch { /* skip ถ้า GitHub ไม่ตอบ */ }
  }

  _docsCache = result;
  _docsCacheTime = now;
  return result;
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
      const reply = await callOpenRouter(apiKey, messages, { text: message });
      return { reply, scope: resolvedScope };
    } catch (err) {
      console.error('aiChatAgent error:', err);
      throw new https.HttpsError('internal', `AI Error: ${err.message}`);
    }
  }
);

// ── AI Intent Classifier + Thai→Technical Translator ─────────────────────
// รับภาษาชาวบ้านจากพี่พีช → วิเคราะห์ว่าต้องการแก้ระบบหรือแค่ถาม → แปลเป็น technical spec
async function classifyAndTranslate(apiKey, message, history, currentScope) {
  const systemPrompt = `คุณคือตัวแปลภาษาชาวบ้านเป็นคำสั่งโปรแกรมเมอร์ สำหรับ CHINCHA FLOW:
- ร้านชินชา / ร้านน้ำ / ชา (scope: tea) — แอปขายชา apps/chincha-tea/, หน้า POS, สต๊อกแก้ว, พนักงาน, LINE บอทชา
- โกอ้วนซีฟู้ด / ร้านกุ้ง / กุ้ง (scope: seafood) — แอปขายกุ้ง apps/seafood-pos/, สต๊อก FIFO, ลูกค้า, LINE บอทกุ้ง
- LINE Bot (scope: webhook) — บอทกลุ่ม LINE, webhook, notify, การส่งข้อความ
- ทั่วไป (scope: root) — หลายส่วนหรือไม่ชัดเจน

วิเคราะห์ว่าพี่พีช (เจ้าของ) ต้องการแก้ไขระบบ หรือแค่ถามข้อมูล ตอบ JSON เท่านั้น:

ถ้าต้องการแก้/เพิ่ม/เปลี่ยนพฤติกรรมของแอปหรือบอท:
{"intent":"code-action","scope":"tea|seafood|webhook|root","translatedMessage":"[อธิบายเป็นภาษาเทคนิค: ส่วนไหนของระบบ, พฤติกรรมที่ต้องการ, ปัญหาที่เกิด]","confirmation":"[สรุปสั้น 1 ประโยค ว่าเข้าใจว่าพี่ต้องการอะไร]"}

ถ้าแค่ถาม, คุยทั่วไป, ขอข้อมูล, หรือคำสั่งไม่ชัดพอ:
{"intent":"chat"}

ถ้าไม่แน่ใจ ให้เลือก chat เสมอ (ปลอดภัยกว่า)`;

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
        max_tokens: 400,
      }),
    });
    if (!res.ok) return { intent: 'chat' };
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { intent: 'chat' };
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      intent: parsed.intent || 'chat',
      scope: parsed.scope || currentScope || 'root',
      translatedMessage: parsed.translatedMessage || message,
      confirmation: parsed.confirmation || '',
    };
  } catch {
    return { intent: 'chat' };
  }
}

// ── V1 onRequest fallback (for direct HTTP calls from PWA) ────────────────
exports.aiChatAgentHttp = functions
  .runWith({ memory: '512MB', timeoutSeconds: 540 })
  .region('asia-southeast1')
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    // ── Progress polling endpoint: GET ?action=progress&requestId=xxx ────
    if (req.method === 'GET' && req.query.action === 'progress' && req.query.requestId) {
      const data = await readProgress(req.query.requestId);
      res.json(data);
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'ใช้ POST เท่านั้น' });
      return;
    }

    const { message, history, scope, imageBase64, images, requestId } = req.body || {};

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

    // ── Code Metrics shortcut: ถ้าถามเรื่องบรรทัด ตอบจาก docs/CODE_METRICS.md ──
    if (isCodeMetricsQuery(message)) {
      const ghPat = process.env.GH_PAT;
      const metrics = ghPat ? await fetchCodeMetrics(ghPat).catch(() => null) : null;
      if (metrics) {
        res.json({ reply: `📊 **Code Metrics ล่าสุด**\n\n${metrics}`, scope: currentScope });
        return;
      }
      // ถ้ายังไม่มีไฟล์ (ยังไม่เคยรัน workflow) บอกพี่
      res.json({ reply: 'ยังไม่มีข้อมูล metrics ครับพี่ — ไปกด Run ที่ GitHub Actions → Code Metrics ก่อนนะคะ แล้วจีจี้จะอ่านได้เลย 🌸', scope: currentScope });
      return;
    }

    // ── AI Intent Classifier: แปลภาษาชาวบ้านเป็นคำสั่งโปรแกรมเมอร์ ─────────
    await writeProgress(requestId, 'กำลังวิเคราะห์คำสั่ง...');
    const classified = await classifyAndTranslate(apiKey, message, history, resolvedScope);
    const finalScope = classified.scope || resolvedScope;

    if (classified.intent === 'code-action') {
      try {
        // V2: agentic loop (tool calling) — fallback to V1 ถ้า error
        const { handleCodeActionV2 } = require('./aiWorkflowAgent');
        const result = await handleCodeActionV2({
          message: classified.translatedMessage,
          history: history || [],
          scope: finalScope,
          force: true,
          requestId: requestId || null,
        });
        await clearProgress(requestId);
        const prefix = classified.confirmation
          ? `จีจี้เข้าใจแล้วนะคะ: "${classified.confirmation}"\n\n`
          : '';
        const body = { ...result.body, reply: prefix + (result.body?.reply || ''), scope: finalScope };
        res.status(result.statusCode || 200).json(body);
        return;
      } catch (err) {
        console.error('aiChatAgentHttp: code-action routing error:', err);
        res.status(500).json({
          reply: `จีจี้พยายามแก้โค้ดแล้วแต่เกิด error ครับพี่ 🌸\n\n` +
            `**สาเหตุ:** ${err.message || 'unknown'}\n\n` +
            `**ตรวจสอบ:**\n` +
            `• GH_PAT ตั้งค่าใน GitHub Secrets แล้วหรือยัง?\n` +
            `• OPENROUTER_API_KEY ยังใช้งานได้อยู่ไหม?\n` +
            `• ดู Firebase Functions logs ที่ Google Cloud Console`,
          scope: finalScope,
          intent: 'code-action',
          status: 'error',
        });
        return;
      }
    }

    // โหลด project docs (กฎ + สไตล์พี่พีช + JIIJI.md) — cache 10 นาที
    const ghPat = process.env.GH_PAT;
    const [agentDocs, jiijiDocs] = ghPat
      ? await Promise.all([
          fetchChatAgentDocs(ghPat).catch(() => ''),
          fetchJiijiDef(ghPat).catch(() => ''),
        ])
      : ['', ''];
    const basePrompt = SYSTEM_PROMPTS[finalScope] || SYSTEM_PROMPTS.root;
    const systemContent = (agentDocs || jiijiDocs)
      ? basePrompt +
        (jiijiDocs ? '\n\n---\n## 🤖 JIIJI.md (ตัวตนและความสามารถของจีจี้)\n' + jiijiDocs : '') +
        (agentDocs ? '\n\n---\n## 📋 กฎและสไตล์การทำงาน (โหลดจาก repo)\n' + agentDocs : '')
      : basePrompt;

    const messages = [
      { role: 'system', content: systemContent },
      ...(history || []).slice(-20),
      { role: 'user', content: message },
    ];

    try {
      const reply = await callOpenRouter(apiKey, messages, { imageBase64: imageBase64 || null, images: images || null, text: message });
      res.json({ reply, scope: finalScope });
    } catch (err) {
      console.error('aiChatAgentHttp error:', err);
      res.status(500).json({ error: `AI Error: ${err.message}` });
    }
  });
