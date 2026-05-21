const functions = require('firebase-functions/v1');
const admin     = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const crypto    = require('crypto');

admin.initializeApp();
const dbShrimp = getFirestore();                  // (default) — ร้านกุ้ง
const dbTea    = getFirestore('chincha');          // chincha   — ร้านน้ำชา

// ── LINE signature verification ───────────────────────────────────────────────
function verifySignature(rawBody, signature, secret) {
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

// ── Parse Thai tea/drink order text ──────────────────────────────────────────
function parseTeaItems(text) {
  const items = [];
  const re = /([฀-๿][฀-๿\s]*?)\s+([\d.]+)\s*(แก้ว|ชิ้น|อัน|ถ้วย|กล่อง|ขวด|ถุง|cup|pcs?)/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    items.push({
      product: m[1].trim(),
      qty:     parseFloat(m[2]),
      unit:    m[3],
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

// ── Today's date (YYYY-MM-DD Bangkok time) ────────────────────────────────────
function todayBKK() {
  return new Date(Date.now() + 7 * 3600000).toISOString().split('T')[0];
}

// ── Send LINE reply ───────────────────────────────────────────────────────────
async function lineReply(replyToken, text, token) {
  if (!token || !replyToken) return;
  try {
    await fetch('https://api.line.me/v2/bot/message/reply', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] }),
    });
  } catch { /* reply is best-effort */ }
}

// ── LINE Webhook — ร้านกุ้ง (seafood) ────────────────────────────────────────
exports.lineWebhook = functions
  .region('asia-southeast1')
  .https.onRequest(async (req, res) => {
    if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }

    const rawBody   = req.rawBody ?? Buffer.from(JSON.stringify(req.body));
    const signature = req.headers['x-line-signature'] || '';
    if (!verifySignature(rawBody, signature, process.env.LINE_CHANNEL_SECRET)) {
      res.status(401).send('Invalid signature'); return;
    }

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
        await dbShrimp.collection('lineOrders').add({
          source: 'line', lineUserId: userId, lineGroupId: groupId,
          rawText: text, items, deliveryDate,
          status: 'pending',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        const summary = items.map(i => `• ${i.product} ${i.qty} ${i.unit}`).join('\n');
        await lineReply(replyToken, `✅ รับออเดอร์แล้วครับ\nส่งวันที่ ${deliveryDate}\n\n${summary}`, process.env.LINE_CHANNEL_ACCESS_TOKEN);
      } else {
        await dbShrimp.collection('line_messages').add({
          userId, groupId, text,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    res.status(200).json({ status: 'ok' });
  });

// ── LINE Webhook — ร้านน้ำชา (CHINCHA) ───────────────────────────────────────
exports.lineWebhookTea = functions
  .region('asia-southeast1')
  .https.onRequest(async (req, res) => {
    if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }

    const rawBody   = req.rawBody ?? Buffer.from(JSON.stringify(req.body));
    const signature = req.headers['x-line-signature'] || '';
    if (!verifySignature(rawBody, signature, process.env.LINE_TEA_CHANNEL_SECRET)) {
      res.status(401).send('Invalid signature'); return;
    }

    const events  = req.body.events || [];
    const dateKey = todayBKK();

    for (const event of events) {
      if (event.type !== 'message' || event.message.type !== 'text') continue;

      const text       = event.message.text.trim();
      const userId     = event.source.userId;
      const groupId    = event.source.groupId || event.source.roomId || null;
      const replyToken = event.replyToken;
      const items      = parseTeaItems(text);

      if (items.length > 0) {
        await dbTea.collection('lineOrders').add({
          source: 'line', lineUserId: userId, lineGroupId: groupId,
          rawText: text, items, dateKey,
          status: 'pending',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        const summary = items.map(i => `• ${i.product} ${i.qty} ${i.unit}`).join('\n');
        await lineReply(replyToken, `✅ รับออเดอร์ชินชาแล้วค่ะ\nวันที่ ${dateKey}\n\n${summary}`, process.env.LINE_TEA_CHANNEL_ACCESS_TOKEN);
      } else {
        await dbTea.collection('line_messages').add({
          userId, groupId, text,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    res.status(200).json({ status: 'ok' });
  });
