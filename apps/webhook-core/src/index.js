const path = require('path');
try {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch {
  /* dotenv optional */
}

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const crypto = require('crypto');
const {
  todayBKK,
  buildSummaryForDate,
  dispatchTeaSummary,
  lineReply,
  HELP_TEXT,
  SUMMARY_CMD,
  HELP_CMD,
  getTeaLineConfig,
} = require('./teaDailySummary');
const { parseOrderItems, ORDER_FORMAT_HELP } = require('./parseLineOrder');

function db() {
  if (!admin.apps.length) admin.initializeApp();
  return getFirestore();
}

// ── LINE signature verification ───────────────────────────────────────────────
function verifySignature(rawBody, signature, secret) {
  if (!secret) return true;
  const hash = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  return hash === signature;
}

function tomorrowBKK() {
  const bkk = new Date(Date.now() + 7 * 3600000);
  bkk.setUTCDate(bkk.getUTCDate() + 1);
  return bkk.toISOString().split('T')[0];
}

// ── LINE Webhook — ร้านกุ้ง (seafood) — รับออเดอร์ลูกค้า ───────────────────
exports.lineWebhook = functions
  .region('asia-southeast1')
  .https.onRequest(async (req, res) => {
    try {
    if (req.method === 'GET') { res.status(200).send('ok'); return; }
    if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }

    const rawBody   = req.rawBody ?? Buffer.from(JSON.stringify(req.body));
    const signature = req.headers['x-line-signature'] || '';
    if (!verifySignature(rawBody, signature, process.env.LINE_CHANNEL_SECRET)) {
      res.status(401).send('Invalid signature'); return;
    }

    const events       = req.body.events || [];
    const deliveryDate = tomorrowBKK();
    const token        = process.env.LINE_CHANNEL_ACCESS_TOKEN;

    for (const event of events) {
      if (event.type !== 'message' || event.message.type !== 'text') continue;

      const text       = event.message.text.trim();
      const userId     = event.source.userId;
      const groupId    = event.source.groupId || event.source.roomId || null;
      const replyToken = event.replyToken;
      const items      = parseOrderItems(text);

      if (items.length > 0) {
        await db().collection('lineOrders').add({
          source: 'line', lineUserId: userId, lineGroupId: groupId,
          rawText: text, items, deliveryDate,
          status: 'pending',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        const summary = items.map(i => `• ${i.product} ${i.qty} ${i.unit}`).join('\n');
        await lineReply(replyToken, `✅ รับออเดอร์แล้วครับ\nส่งวันที่ ${deliveryDate}\n\n${summary}`, token);
      } else if (/^(help|ช่วย|วิธี|สั่งยังไง)/i.test(text)) {
        await lineReply(replyToken, ORDER_FORMAT_HELP, token);
      } else {
        await db().collection('line_messages').add({
          userId, groupId, text,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        await lineReply(
          replyToken,
          `ยังอ่านรายการไม่ได้ครับ\n\n${ORDER_FORMAT_HELP}`,
          token,
        );
      }
    }

    res.status(200).json({ status: 'ok' });
    } catch (err) {
      console.error('lineWebhook', err);
      res.status(500).json({ error: 'internal' });
    }
  });

// ── LINE Webhook — ร้านชา: บอทแจ้งสรุปปิดวัน (ไม่รับออเดอร์ลูกค้า) ───────────
exports.lineWebhookTea = functions
  .region('asia-southeast1')
  .https.onRequest(async (req, res) => {
    try {
    if (req.method === 'GET') { res.status(200).send('ok'); return; }
    if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }

    const rawBody   = req.rawBody ?? Buffer.from(JSON.stringify(req.body));
    const signature = req.headers['x-line-signature'] || '';
    const token     = process.env.LINE_TEA_CHANNEL_ACCESS_TOKEN;
    if (!verifySignature(rawBody, signature, process.env.LINE_TEA_CHANNEL_SECRET)) {
      res.status(401).send('Invalid signature'); return;
    }

    const events = req.body.events || [];

    for (const event of events) {
      if (event.type !== 'message' || event.message.type !== 'text') continue;

      const text       = event.message.text.trim();
      const replyToken = event.replyToken;
      const userId     = event.source.userId;
      const groupId    = event.source.groupId || event.source.roomId || null;

      if (HELP_CMD.test(text)) {
        await lineReply(replyToken, HELP_TEXT, token);
        continue;
      }

      if (SUMMARY_CMD.test(text)) {
        const dateKey = todayBKK();
        try {
          const summary = await buildSummaryForDate(db(), dateKey);
          await lineReply(replyToken, summary, token);
          const config = await getTeaLineConfig(db());
          if (config.notifyGroupId && groupId && config.notifyGroupId !== groupId) {
            await dispatchTeaSummary(db(), dateKey, token);
          }
        } catch (err) {
          console.error('tea summary reply', err);
          await lineReply(replyToken, '⚠️ ดึงสรุปไม่สำเร็จ ลองใหม่หรือตรวจสอบข้อมูลในแอป', token);
        }
        continue;
      }

      await db().collection('line_messages').add({
        userId, groupId, text,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await lineReply(
        replyToken,
        'พิมพ์ "สรุป" เพื่อดูยอดขายวันนี้\nพิมพ์ "help" ดูคำสั่ง',
        token,
      );
    }

    res.status(200).json({ status: 'ok' });
    } catch (err) {
      console.error('lineWebhookTea', err);
      res.status(500).json({ error: 'internal' });
    }
  });

// ── แอดมินกดส่งสรุปจากแอป (Bearer Firebase ID token) ─────────────────────────
exports.teaPushSummary = functions
  .region('asia-southeast1')
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    if (req.method === 'GET') { res.status(200).json({ ok: true, hint: 'POST with Bearer token' }); return; }
    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
    if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }

    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) { res.status(401).json({ error: 'unauthorized' }); return; }

    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      const userSnap = await db().collection('users').doc(decoded.uid).get();
      const user = userSnap.data();
      if (!userSnap.exists || user.approved !== true || user.role !== 'admin') {
        res.status(403).json({ error: 'admin only' }); return;
      }

      const dateKey = (req.body && req.body.dateKey) || todayBKK();
      const token = process.env.LINE_TEA_CHANNEL_ACCESS_TOKEN;
      if (!token) { res.status(500).json({ error: 'LINE token not configured' }); return; }

      const { message, results, targetCount } = await dispatchTeaSummary(db(), dateKey, token);
      if (targetCount === 0) {
        res.status(400).json({
          error: 'no_targets',
          hint: 'ตั้ง notifyGroupId ในแอป → แอดมิน → LINE Bot',
        });
        return;
      }

      res.json({ ok: true, dateKey, sent: results.filter((r) => r.ok).length, targets: results });
    } catch (err) {
      console.error('teaPushSummary', err);
      res.status(500).json({ error: err.message || 'failed' });
    }
  });
