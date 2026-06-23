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
const { todayBKK, lineReply } = require('./shared/lineUtils');
const { dispatchTeaSummary } = require('./tea/teaDailySummary');
const { handleTeaLineWebhook } = require('./tea/teaWebhook');
const { claimLineEvent, completeLineEvent, releaseLineEvent } = require('./shared/webhookDedup');
const { handleShrimpLineWebhookEvent } = require('./seafood-oa/shrimpLineWebhookRouter');
const {
  verifyShrimpStaff,
  pushShrimpBillToCustomer,
} = require('./seafood-notify/shrimpLinePush');
const { handleShrimpLiffOrderRequest } = require('./seafood-oa/shrimpLiffOrderSubmit');
const { handleShrimpLiffSlipRequest } = require('./seafood-oa/shrimpLiffSlip');
const {
  notifyShrimpLineOrder,
  notifyShrimpPaymentSlip,
  notifyShrimpSaleDeleteRequest,
  notifyTeaRestock,
} = require('./seafood-notify/instantLineNotify');

function db() {
  if (!admin.apps.length) admin.initializeApp();
  return getFirestore();
}

function verifySignature(rawBody, signature, secret) {
  if (!secret) return false;
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

      const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body));
      const signature = req.headers['x-line-signature'] || '';
      if (!verifySignature(rawBody, signature, process.env.LINE_CHANNEL_SECRET)) {
        res.status(401).send('Invalid signature'); return;
      }

      const events = req.body.events || [];
      const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;

      for (const event of events) {
        if (event.type !== 'follow' && event.type !== 'message') continue;
        if (event.deliveryContext?.isRedelivery) continue;
        if (!(await claimLineEvent(db(), event))) continue;

        try {
          if (!admin.apps.length) admin.initializeApp();
          await handleShrimpLineWebhookEvent(db(), admin, { event, token });
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
      if (!admin.apps.length) admin.initializeApp();
      await handleTeaLineWebhook(db(), admin, req, res);
    } catch (err) {
      console.error('lineWebhookTea', err);
      res.status(500).json({ error: 'internal' });
    }
  });

// ── พนักงานส่งภาพบิลให้ลูกค้าทาง LINE OA (Bearer Firebase ID token) ─────────────
exports.shrimpPushBill = functions
  .region('asia-southeast1')
  .runWith({ timeoutSeconds: 60, memory: '1GB' })
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    if (req.method === 'GET') {
      res.status(200).json({ ok: true, hint: 'POST { lineUserId, billData? | imageBase64, billNo?, customerName? }' });
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
        billData: body.billData,
        billNo: body.billNo,
        customerName: body.customerName,
        paymentType: body.paymentType,
        remainingAmount: body.remainingAmount,
        total: body.total,
        saleId: body.saleId || body.billData?.saleId || null,
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
        let lineMsg = '';
        try { lineMsg = JSON.parse(err.lineErrBody || '{}').message || ''; } catch {}
        res.status(502).json({
          error: code,
          hint: 'LINE ปฏิเสธการส่ง — ลูกค้าอาจบล็อก OA หรือยังไม่ได้เพิ่มเป็นเพื่อน',
          lineStatus: err.status,
          lineMessage: lineMsg,
        });
        return;
      }
      console.error('shrimpPushBill', err);
      res.status(500).json({ error: err.message || 'failed' });
    }
  });

// ── พนักงานสร้างภาพบิลบน Cloud (Satori) — Bearer Firebase ID token ───────────
exports.shrimpRenderBill = functions
  .region('asia-southeast1')
  .runWith({ timeoutSeconds: 60, memory: '1GB' })
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    if (req.method === 'GET') {
      res.status(200).json({ ok: true, hint: 'POST { billData }' });
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

      const billData = req.body?.billData;
      if (!billData || typeof billData !== 'object') {
        res.status(400).json({ error: 'billData_required' });
        return;
      }
      const { renderShrimpBillJpeg } = require('./seafood-notify/shrimpBillRender');
      const buffer = await renderShrimpBillJpeg(billData);
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'private, max-age=60');
      res.status(200).send(buffer);
    } catch (err) {
      console.error('shrimpRenderBill', err);
      res.status(500).json({ error: err.message || 'render_failed' });
    }
  });

// ── Pre-render ภาพบิลเก็บ cache (Bearer Firebase ID token) ───────────────────
exports.shrimpPreRenderBill = functions
  .region('asia-southeast1')
  .runWith({ timeoutSeconds: 60, memory: '1GB' })
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    if (req.method === 'GET') {
      res.status(200).json({ ok: true, hint: 'POST { saleId, billData }' });
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

      const saleId = String(req.body?.saleId || req.body?.billData?.saleId || '').trim();
      const billData = req.body?.billData;
      if (!saleId || !billData || typeof billData !== 'object') {
        res.status(400).json({ error: 'saleId_and_billData_required' });
        return;
      }
      const { preRenderBillForSale } = require('./seafood-notify/shrimpBillPreRender');
      const result = await preRenderBillForSale(db(), admin, saleId, billData);
      res.json({ ok: true, ...result });
    } catch (err) {
      console.error('shrimpPreRenderBill', err);
      res.status(500).json({ error: err.message || 'prerender_failed' });
    }
  });

// ── LIFF สั่งกุ้ง (LINE id_token) → lineOrders ───────────────────────────────
exports.shrimpLiffOrder = functions
  .region('asia-southeast1')
  .runWith({ timeoutSeconds: 30, memory: '256MB' })
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'GET') {
      res.status(200).json({
        ok: true,
        hint: 'POST { action: "context"|"submit", idToken, river?, deliveryDate?, customerId? }',
      });
      return;
    }
    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
    if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }

    try {
      if (!admin.apps.length) admin.initializeApp();
      const result = await handleShrimpLiffOrderRequest(db(), admin, req.body || {});
      res.json(result);
    } catch (err) {
      const code = err.code || 'failed';
      if (code === 'missing_id_token' || code === 'invalid_id_token') {
        res.status(401).json({ error: code, hint: 'เปิดฟอร์มจาก LINE OA อีกครั้ง' });
        return;
      }
      if (code === 'liff_not_configured') {
        res.status(500).json({ error: code, hint: 'ตั้ง LINE_LIFF_ID ใน Cloud Functions' });
        return;
      }
      if (code === 'empty_order' || code === 'invalid_weight' || code === 'invalid_delivery_date') {
        res.status(400).json({ error: code, hint: err.message });
        return;
      }
      if (code === 'customer_required' || code === 'customer_not_found') {
        res.status(400).json({ error: code, hint: 'เลือกชื่อลูกค้าในรายชื่อ' });
        return;
      }
      console.error('shrimpLiffOrder', err);
      res.status(500).json({ error: err.message || 'failed' });
    }
  });

// ── LIFF ฝากสลิป (LINE id_token + รูป base64) ─────────────────────────────────
exports.shrimpLiffSlip = functions
  .region('asia-southeast1')
  .runWith({ timeoutSeconds: 60, memory: '512MB' })
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'GET') {
      res.status(200).json({
        ok: true,
        hint: 'POST { idToken, imageBase64, billNo? }',
      });
      return;
    }
    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
    if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }

    try {
      if (!admin.apps.length) admin.initializeApp();
      const result = await handleShrimpLiffSlipRequest(db(), admin, req.body || {});
      res.json(result);
    } catch (err) {
      const code = err.code || 'failed';
      if (code === 'missing_id_token' || code === 'invalid_id_token') {
        res.status(401).json({ error: code, hint: 'เปิดจาก LINE OA อีกครั้ง' });
        return;
      }
      if (code === 'invalid_image' || code === 'invalid_slip') {
        res.status(400).json({ error: code, hint: 'เลือกรูปสลิปใหม่ (ไม่เกิน 9 MB)' });
        return;
      }
      if (code === 'liff_not_configured') {
        res.status(500).json({ error: code, hint: 'ตั้ง LINE_LIFF_ID / LINE_LIFF_SLIP_ID' });
        return;
      }
      console.error('shrimpLiffSlip', err);
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
      if (!admin.apps.length) admin.initializeApp();
      const decoded = await admin.auth().verifyIdToken(idToken);
      const userSnap = await db().collection('users').doc(decoded.uid).get();
      const user = userSnap.data();
      if (!userSnap.exists || user.approved !== true) {
        res.status(403).json({ error: 'forbidden' }); return;
      }
      const role = user.role || 'staff';
      if (!['admin', 'manager', 'staff'].includes(role)) {
        res.status(403).json({ error: 'forbidden' }); return;
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
      const sent = results.filter((r) => r.ok).length;
      if (sent === 0) {
        res.status(502).json({
          error: 'line_push_failed',
          hint: 'เช็กว่า Group ID ถูกต้อง และ LINE OA ถูกเชิญเข้ากลุ่มแล้ว',
          targets: results,
        });
        return;
      }

      res.json({ ok: true, dateKey, sent, targets: results });
    } catch (err) {
      console.error('teaPushSummary', err);
      res.status(500).json({ error: err.message || 'failed' });
    }
  });

// ── Firestore triggers — แจ้งเตือน LINE ─────────────────────────────────────
exports.onShrimpLineOrderCreated = functions
  .region('asia-southeast1')
  .firestore.document('lineOrders/{orderId}')
  .onCreate(async (snap) => {
    try {
      const data = snap.data();
      if (data?.notifySentAt) {
        console.log('onShrimpLineOrderCreated skip already_sent');
        return;
      }
      const result = await notifyShrimpLineOrder(db(), { id: snap.id, ...data }, { orderId: snap.id });
      if (result.skipped) console.log('onShrimpLineOrderCreated', result.skipped);
      else console.log('onShrimpLineOrderCreated sent', result.sent, result.targets);
    } catch (err) {
      console.error('onShrimpLineOrderCreated', err);
    }
  });

exports.onTeaRestockCreated = functions
  .region('asia-southeast1')
  .firestore.document('restocks/{restockId}')
  .onCreate(async (snap) => {
    try {
      const data = { id: snap.id, ...snap.data() };
      const result = await notifyTeaRestock(db(), data);
      if (result.skipped) console.log('onTeaRestockCreated', result.skipped);
      else console.log('onTeaRestockCreated sent', result.sent);
    } catch (err) {
      console.error('onTeaRestockCreated', err);
    }
  });

exports.onShrimpPaymentSlipCreated = functions
  .region('asia-southeast1')
  .firestore.document('paymentSlipSubmissions/{submissionId}')
  .onCreate(async (snap) => {
    try {
      const data = snap.data();
      if (data?.notifySentAt) return;
      const result = await notifyShrimpPaymentSlip(db(), data, { submissionId: snap.id });
      if (result.skipped) console.log('onShrimpPaymentSlipCreated', result.skipped);
      else console.log('onShrimpPaymentSlipCreated sent', result.sent);
    } catch (err) {
      console.error('onShrimpPaymentSlipCreated', err);
    }
  });

exports.onShrimpAdminAlertCreated = functions
  .region('asia-southeast1')
  .firestore.document('shrimpAdminAlerts/{alertId}')
  .onCreate(async (snap) => {
    try {
      const data = snap.data();
      if (data?.notifySentAt) return;
      const result = await notifyShrimpSaleDeleteRequest(db(), data, { alertId: snap.id });
      if (result.skipped) console.log('onShrimpAdminAlertCreated', result.skipped);
      else console.log('onShrimpAdminAlertCreated sent', result.sent);
    } catch (err) {
      console.error('onShrimpAdminAlertCreated', err);
    }
  });

// ── Deploy Notify — รับสถานะ deploy จาก GitHub Actions ─────────────────────
const { writeDeployStatus } = require('./deployNotify');

exports.deployNotifyHttp = functions
  .region('asia-southeast1')
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
    if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }

    const ghPat = process.env.GH_PAT;
    const auth = (req.headers['authorization'] || '').replace('Bearer ', '').trim();
    if (!ghPat || auth !== ghPat) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    const { app, status, workflow, runId, sha } = req.body || {};
    if (!app || !status) {
      res.status(400).json({ error: 'app and status required' });
      return;
    }

    try {
      if (!admin.apps.length) admin.initializeApp();
      await writeDeployStatus(app, status, { workflow, runId, sha });
      res.json({ ok: true });
    } catch (err) {
      console.error('deployNotifyHttp', err);
      res.status(500).json({ error: err.message || 'failed' });
    }
  });

// ── AI Chat + Workflow Agent ──────────────────────────────────────────────────
Object.assign(exports, require('./aiChatAgent'));
