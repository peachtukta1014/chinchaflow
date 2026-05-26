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
const { claimLineEvent, completeLineEvent, releaseLineEvent } = require('./webhookDedup');
const { classifyShrimpLineMessage } = require('./shrimpLineIntent');
const { processShrimpLineOrder } = require('./shrimpLineOrderHandler');
const {
  buildShrimpSummaryForDate,
  SHRIMP_HELP_TEXT,
} = require('./shrimpDailySummary');
const {
  verifyShrimpStaff,
  pushShrimpBillToCustomer,
} = require('./shrimpLinePush');

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

    const events = req.body.events || [];
    const token  = process.env.LINE_CHANNEL_ACCESS_TOKEN;

    for (const event of events) {
      if (event.type !== 'message' || event.message.type !== 'text') continue;
      if (event.deliveryContext?.isRedelivery) continue;
      if (!(await claimLineEvent(db(), event))) continue;

      try {
        const text       = event.message.text.trim();
        const userId     = event.source.userId;
        const groupId    = event.source.groupId || event.source.roomId || null;
        const replyToken = event.replyToken;
        const intent     = classifyShrimpLineMessage(text);

        if (intent === 'ignore') {
          await completeLineEvent(db(), event);
          continue;
        }

        if (intent === 'help') {
          await lineReply(replyToken, SHRIMP_HELP_TEXT, token);
          await completeLineEvent(db(), event);
          continue;
        }

        if (intent === 'summary') {
          try {
            const dateKey = todayBKK();
            const summary = await buildShrimpSummaryForDate(db(), dateKey);
            await lineReply(replyToken, summary, token);
          } catch (err) {
            console.error('shrimp summary', err);
            await lineReply(replyToken, '⚠️ ดึงสรุปไม่สำเร็จ ลองใหม่ครับ', token);
          }
          await completeLineEvent(db(), event);
          continue;
        }

        const result = await processShrimpLineOrder(db(), admin, { text, userId, groupId });
        await lineReply(replyToken, result.reply, token);
        await completeLineEvent(db(), event);
      } catch (err) {
        await releaseLineEvent(db(), event);
        throw err;
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
      if (event.deliveryContext?.isRedelivery) continue;
      if (!(await claimLineEvent(db(), event))) continue;

      try {
        const text       = event.message.text.trim();
        const replyToken = event.replyToken;
        const userId     = event.source.userId;
        const groupId    = event.source.groupId || event.source.roomId || null;

        if (HELP_CMD.test(text)) {
          await lineReply(replyToken, HELP_TEXT, token);
          await completeLineEvent(db(), event);
          continue;
        }

        if (SUMMARY_CMD.test(text)) {
          const dateKey = todayBKK();
          try {
            const summary = await buildSummaryForDate(db(), dateKey);
            await lineReply(replyToken, summary, token);
          } catch (err) {
            console.error('tea summary reply', err);
            await lineReply(replyToken, '⚠️ ดึงสรุปไม่สำเร็จ ลองใหม่หรือตรวจสอบข้อมูลในแอป', token);
          }
          await completeLineEvent(db(), event);
          continue;
        }

        await db().collection('line_messages').add({
          userId, groupId, text,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        await completeLineEvent(db(), event);
      } catch (err) {
        await releaseLineEvent(db(), event);
        throw err;
      }
    }

    res.status(200).json({ status: 'ok' });
    } catch (err) {
      console.error('lineWebhookTea', err);
      res.status(500).json({ error: 'internal' });
    }
  });

// ── พนักงานส่งภาพบิลให้ลูกค้าทาง LINE OA (Bearer Firebase ID token) ─────────────
exports.shrimpPushBill = functions
  .region('asia-southeast1')
  .runWith({ timeoutSeconds: 60, memory: '512MB' })
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    if (req.method === 'GET') {
      res.status(200).json({ ok: true, hint: 'POST { lineUserId, imageBase64, billNo?, customerName? }' });
      return;
    }
    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
    if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }

    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) { res.status(401).json({ error: 'unauthorized' }); return; }

    try {
      if (!admin.apps.length) admin.initializeApp();
      const decoded = await admin.auth().verifyIdToken(idToken);
      await verifyShrimpStaff(db(), decoded.uid);

      const body = req.body || {};
      const result = await pushShrimpBillToCustomer(db(), admin, {
        lineUserId: body.lineUserId,
        imageBase64: body.imageBase64,
        billNo: body.billNo,
        customerName: body.customerName,
      });
      res.json(result);
    } catch (err) {
      const code = err.code || 'failed';
      if (code === 'forbidden') {
        res.status(403).json({ error: 'forbidden', hint: 'ต้องเป็นสมาชิกที่อนุมัติแล้ว' });
        return;
      }
      if (code === 'invalid_line_user_id') {
        res.status(400).json({ error: code, hint: 'LINE User ID ต้องขึ้นต้น U (33 ตัวอักษร)' });
        return;
      }
      if (code === 'line_token_missing') {
        res.status(500).json({ error: code, hint: 'ยังไม่ได้ตั้ง LINE_CHANNEL_ACCESS_TOKEN' });
        return;
      }
      if (code === 'line_push_failed') {
        res.status(502).json({
          error: code,
          hint: 'ลูกค้าต้องเคยแอด LINE OA เป็นเพื่อนก่อนถึงส่งได้',
          status: err.status,
        });
        return;
      }
      console.error('shrimpPushBill', err);
      res.status(500).json({ error: err.message || 'failed' });
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

      const { message, results, targetCount } = await dispatchTeaSummary(db(), dateKey, token, { force: true });
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

// สรุปอัตโนมัติ: ใช้ apps/webhook-core-scheduled (ต้องเปิด Cloud Scheduler API ใน GCP)
// หรือส่งด้วยมือจากแอดมิน / พิมพ์ "สรุป" ในกลุ่ม LINE
