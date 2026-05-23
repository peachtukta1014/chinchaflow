const functions = require('firebase-functions/v1');
const admin     = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const crypto    = require('crypto');
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

admin.initializeApp();
const dbShrimp = getFirestore();                  // (default) — ร้านกุ้ง
const dbTea    = getFirestore();                  // (default) — ร้านชา

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

function tomorrowBKK() {
  const bkk = new Date(Date.now() + 7 * 3600000);
  bkk.setUTCDate(bkk.getUTCDate() + 1);
  return bkk.toISOString().split('T')[0];
}

// ── LINE Webhook — ร้านกุ้ง (seafood) — รับออเดอร์ลูกค้า ───────────────────
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
    const token        = process.env.LINE_CHANNEL_ACCESS_TOKEN;

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
        await lineReply(replyToken, `✅ รับออเดอร์แล้วครับ\nส่งวันที่ ${deliveryDate}\n\n${summary}`, token);
      } else {
        await dbShrimp.collection('line_messages').add({
          userId, groupId, text,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    res.status(200).json({ status: 'ok' });
  });

// ── LINE Webhook — ร้านชา: บอทแจ้งสรุปปิดวัน (ไม่รับออเดอร์ลูกค้า) ───────────
exports.lineWebhookTea = functions
  .region('asia-southeast1')
  .https.onRequest(async (req, res) => {
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
          const summary = await buildSummaryForDate(dbTea, dateKey);
          await lineReply(replyToken, summary, token);
          const config = await getTeaLineConfig(dbTea);
          if (config.notifyGroupId && groupId && config.notifyGroupId !== groupId) {
            await dispatchTeaSummary(dbTea, dateKey, token);
          }
        } catch (err) {
          console.error('tea summary reply', err);
          await lineReply(replyToken, '⚠️ ดึงสรุปไม่สำเร็จ ลองใหม่หรือตรวจสอบข้อมูลในแอป', token);
        }
        continue;
      }

      await dbTea.collection('line_messages').add({
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
  });

// ── ส่งสรุปอัตโนมัติทุกวัน (เวลาไทย) ────────────────────────────────────────
exports.teaDailyScheduledSummary = functions
  .region('asia-southeast1')
  .pubsub.schedule('0 * * * *')
  .timeZone('Asia/Bangkok')
  .onRun(async () => {
    const config = await getTeaLineConfig(dbTea);
    if (config.autoSummaryEnabled === false) return null;

    const hourNow = parseInt(
      new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Bangkok' }),
      10,
    );
    const targetHour = typeof config.autoSummaryHour === 'number' ? config.autoSummaryHour : 22;
    if (hourNow !== targetHour) return null;

    const token = process.env.LINE_TEA_CHANNEL_ACCESS_TOKEN;
    if (!token) {
      console.warn('LINE_TEA_CHANNEL_ACCESS_TOKEN not set');
      return null;
    }

    const dateKey = todayBKK();
    const { targetCount } = await dispatchTeaSummary(dbTea, dateKey, token);
    if (targetCount === 0) {
      console.warn('teaDailyScheduledSummary: no notifyGroupId / notifyUserIds in config/teaLine');
    }
    return null;
  });

// ── แอดมินกดส่งสรุปจากแอป (Bearer Firebase ID token) ─────────────────────────
exports.teaPushSummary = functions
  .region('asia-southeast1')
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
    if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }

    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) { res.status(401).json({ error: 'unauthorized' }); return; }

    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      const userSnap = await dbTea.collection('users').doc(decoded.uid).get();
      const user = userSnap.data();
      if (!userSnap.exists || user.approved !== true || user.role !== 'admin') {
        res.status(403).json({ error: 'admin only' }); return;
      }

      const dateKey = (req.body && req.body.dateKey) || todayBKK();
      const token = process.env.LINE_TEA_CHANNEL_ACCESS_TOKEN;
      if (!token) { res.status(500).json({ error: 'LINE token not configured' }); return; }

      const { message, results, targetCount } = await dispatchTeaSummary(dbTea, dateKey, token);
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
