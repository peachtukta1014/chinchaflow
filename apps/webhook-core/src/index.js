const functions = require('firebase-functions');
const admin     = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const crypto    = require('crypto');

admin.initializeApp();
const db = getFirestore('chincha');

// ── LINE signature verification ───────────────────────────────────────────────
function verifySignature(body, signature) {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) return true; // skip if not configured
  const hash = crypto.createHmac('sha256', secret).update(body).digest('base64');
  return hash === signature;
}

// ── Parse Thai seafood order text ─────────────────────────────────────────────
// Handles: "กุ้งใหญ่ 2 กก", "กุ้งกลาง 1.5 กิโล", "กุ้งตาย 50 บาท"
function parseOrderItems(text) {
  const items = [];
  // Match: <product-name> <number> <unit>
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

// ── Tomorrow's date (YYYY-MM-DD in Bangkok time) ──────────────────────────────
function tomorrowBKK() {
  const now = new Date();
  // UTC+7
  const bkk = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  bkk.setUTCDate(bkk.getUTCDate() + 1);
  return bkk.toISOString().split('T')[0];
}

// ── Send LINE reply ───────────────────────────────────────────────────────────
async function lineReply(replyToken, text) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token || !replyToken) return;
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: 'text', text }],
    }),
  });
}

// ── LINE Webhook ──────────────────────────────────────────────────────────────
exports.lineWebhook = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const rawBody  = JSON.stringify(req.body);
  const signature = req.headers['x-line-signature'] || '';
  if (!verifySignature(rawBody, signature)) return res.status(401).send('Invalid signature');

  const events = req.body.events || [];
  const deliveryDate = tomorrowBKK();

  for (const event of events) {
    if (event.type !== 'message' || event.message.type !== 'text') continue;

    const text       = event.message.text.trim();
    const userId     = event.source.userId;
    const groupId    = event.source.groupId || event.source.roomId || null;
    const replyToken = event.replyToken;

    const items = parseOrderItems(text);

    if (items.length > 0) {
      // Save as delivery order for tomorrow
      await db.collection('lineOrders').add({
        source:       'line',
        lineUserId:   userId,
        lineGroupId:  groupId,
        rawText:      text,
        items,
        deliveryDate,
        status:       'pending',
        createdAt:    admin.firestore.FieldValue.serverTimestamp(),
      });

      // Reply with confirmation
      const summary = items.map(i => `• ${i.product} ${i.qty} ${i.unit}`).join('\n');
      await lineReply(replyToken, `✅ รับออเดอร์แล้วครับ\nส่งวันที่ ${deliveryDate}\n\n${summary}`);
    } else {
      // Save raw message for reference
      await db.collection('line_messages').add({
        userId, groupId, text,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }

  return res.status(200).json({ status: 'ok' });
});
