const functions = require('firebase-functions/v1');
const admin     = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const crypto    = require('crypto');

admin.initializeApp();
const db = getFirestore('chincha');

// ── CORS helper ───────────────────────────────────────────────────────────────
function cors(res) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
}

// ── Gemini REST helper ────────────────────────────────────────────────────────
async function callGemini(parts, jsonMode = false) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');
  const body = {
    contents: [{ parts }],
    generationConfig: jsonMode
      ? { responseMimeType: 'application/json', temperature: 0 }
      : { temperature: 0 },
  };
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );
  const data = await resp.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// ── Gemini OCR: analyze bill photo ────────────────────────────────────────────
exports.geminiOcr = functions
  .region('asia-southeast1')
  .https.onRequest(async (req, res) => {
    cors(res);
    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
    if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }
    const { imageBase64, mimeType } = req.body;
    if (!imageBase64) { res.status(400).json({ error: 'imageBase64 required' }); return; }
    try {
      const text = await callGemini([
        { text: 'ดูรูปบิลนี้ บอกน้ำหนักกุ้ง (กก.) และราคาต่อกิโล (บาท/กก.) ตอบเฉพาะ JSON เท่านั้น ไม่ต้องอธิบาย รูปแบบ: {"weight":number|null,"pricePerKg":number|null}' },
        { inlineData: { mimeType: mimeType || 'image/jpeg', data: imageBase64 } },
      ], true);
      res.json({ success: true, text });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

// ── Gemini Voice: parse Thai voice command → structured JSON ──────────────────
exports.geminiVoice = functions
  .region('asia-southeast1')
  .https.onRequest(async (req, res) => {
    cors(res);
    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
    if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }
    const { text, customers } = req.body;
    if (!text) { res.status(400).json({ error: 'text required' }); return; }
    const custList = (customers || []).map(c => `${c.id}:${c.name}`).join(', ');
    const prompt =
      `วิเคราะห์คำสั่งเสียงภาษาไทย: "${text}"\n` +
      `ลูกค้า (id:ชื่อ): ${custList}\n` +
      `สินค้า: large=ไซส์ใหญ่, medium=ไซส์กลาง, small=ไซส์เล็กหรือจิ๋ว, dead=กุ้งตาย\n` +
      `ตอบ JSON เท่านั้น: {"customerId":"id หรือ null","productId":"large|medium|small|dead หรือ null","weight":"ตัวเลข หรือ null"}`;
    try {
      const raw    = await callGemini([{ text: prompt }], true);
      const parsed = JSON.parse(raw);
      const n = (v) => (!v || v === 'null') ? null : v;
      res.json({ success: true, result: { customerId: n(parsed.customerId), productId: n(parsed.productId), weight: n(parsed.weight) } });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

// ── LINE signature verification ───────────────────────────────────────────────
function verifySignature(rawBody, signature) {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) return true;
  const hash = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  return hash === signature;
}

// ── Parse Thai seafood order text ─────────────────────────────────────────────
function parseOrderItems(text) {
  const items = [];
  const re = /([฀-๿][฀-๿\s]*?)\s+([\d.]+)\s*(กก\.?|กิโล|กิโลกรัม|kg|บาท|฿)/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    items.push({
      product: m[1].trim(),
      qty:     parseFloat(m[2]),
      unit:    m[3].replace('.', '').replace('กิโลกรัม', 'กก').replace('กิโล', 'กก').replace('kg', 'กก').replace('฿', 'บาท'),
    });
  }
  return items;
}

// ── Tomorrow's date (YYYY-MM-DD Bangkok time) ─────────────────────────────────
function tomorrowBKK() {
  const bkk = new Date(Date.now() + 7 * 3600000);
  bkk.setUTCDate(bkk.getUTCDate() + 1);
  return bkk.toISOString().split('T')[0];
}

// ── Send LINE reply ───────────────────────────────────────────────────────────
async function lineReply(replyToken, text) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token || !replyToken) return;
  try {
    await fetch('https://api.line.me/v2/bot/message/reply', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] }),
    });
  } catch { /* reply is best-effort */ }
}

// ── LINE Webhook (v1, works on Spark plan) ────────────────────────────────────
exports.lineWebhook = functions
  .region('asia-southeast1')
  .https.onRequest(async (req, res) => {
    if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }

    const rawBody   = JSON.stringify(req.body);
    const signature = req.headers['x-line-signature'] || '';
    if (!verifySignature(rawBody, signature)) { res.status(401).send('Invalid signature'); return; }

    const events       = req.body.events || [];
    const deliveryDate = tomorrowBKK();

    for (const event of events) {
      if (event.type !== 'message' || event.message.type !== 'text') continue;

      const text       = event.message.text.trim();
      const userId     = event.source.userId;
      const groupId    = event.source.groupId || event.source.roomId || null;
      const replyToken = event.replyToken;
      const items      = parseOrderItems(text);

      if (items.length > 0) {
        await db.collection('lineOrders').add({
          source: 'line', lineUserId: userId, lineGroupId: groupId,
          rawText: text, items, deliveryDate,
          status: 'pending',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        const summary = items.map(i => `• ${i.product} ${i.qty} ${i.unit}`).join('\n');
        await lineReply(replyToken, `✅ รับออเดอร์แล้วครับ\nส่งวันที่ ${deliveryDate}\n\n${summary}`);
      } else {
        await db.collection('line_messages').add({
          userId, groupId, text,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    res.status(200).json({ status: 'ok' });
  });
