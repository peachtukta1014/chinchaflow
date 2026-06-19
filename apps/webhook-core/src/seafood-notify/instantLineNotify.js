const { linePush } = require('../shared/lineUtils');
const { formatDateThai, deliveryDateKind } = require('../seafood-oa/parseDeliveryDate');
const { getShrimpLineConfig } = require('../seafood-oa/shrimpLineConfig');
const { formatOrderCompactLine } = require('../seafood-oa/shrimpTodayOrdersSummary');
const { buildCustomerZoneCatalog, resolveZoneForOrder } = require('../seafood-oa/customerZone');
const { normalizeLineUserId } = require('../seafood-oa/lineUserId');

function collectNotifyTargets(config) {
  const targets = new Set();
  if (!config || typeof config !== 'object') return targets;
  if (config.notifyGroupId) targets.add(String(config.notifyGroupId).trim());
  const extra = config.notifyUserIds;
  if (typeof extra === 'string') {
    extra.split(/[,;\s]+/).filter(Boolean).forEach((id) => targets.add(id));
  } else if (Array.isArray(extra)) {
    extra.filter(Boolean).forEach((id) => targets.add(String(id).trim()));
  }
  return targets;
}

function resolveNotifyTargets(config, orderData) {
  const targets = collectNotifyTargets(config);
  const notifyGroupId = String(config?.notifyGroupId || '').trim();
  // ออเดอร์จากกลุ่ม LINE — ไม่ push ซ้ำเข้ากลุ่ม (เห็น reply บอทในแชตอยู่แล้ว)
  if (orderData?.lineGroupId && notifyGroupId) {
    targets.delete(notifyGroupId);
  }
  // ไม่ push แจ้งเตือนแอดมินกลับไปหาลูกค้าผู้สั่ง
  // (ป้องกันกรณี UID ลูกค้าหลุดเข้า notifyUserIds โดยไม่ตั้งใจ)
  const ordererUid = normalizeLineUserId(orderData?.lineUserId);
  if (ordererUid) targets.delete(ordererUid);
  return targets;
}

/** แจ้งสลิป — ห้าม push ข้อความ staff ไปหาคนที่ส่งสลิป (ลูกค้า OA) */
function resolveSlipNotifyTargets(config, slipData) {
  const targets = collectNotifyTargets(config);
  const submitter = normalizeLineUserId(slipData?.lineUserId);
  if (submitter) targets.delete(submitter);
  return targets;
}

async function pushToTargets(targets, text, token) {
  if (!token || !text || !targets.size) return { sent: 0, targets: [] };
  const results = [];
  for (const to of targets) {
    results.push({ to, ok: await linePush(to, text, token) });
  }
  return { sent: results.filter((r) => r.ok).length, targets: results };
}

function formatShrimpOrderMessage(data, now = new Date(), { compact = false, zone = '' } = {}) {
  if (compact) {
    const items = formatOrderCompactLine(data);
    const dateLabel = data.deliveryDate ? formatDateThai(data.deliveryDate) : '—';
    const kind = data.deliveryDate ? deliveryDateKind(data.deliveryDate, now) : 'other';
    let ship = dateLabel;
    if (kind === 'today') ship = `วันนี้ ${dateLabel}`;
    else if (kind === 'tomorrow') ship = `พรุ่งนี้ ${dateLabel}`;
    const zoneLabel = zone && zone !== 'อื่นๆ' ? `[${zone}] ` : '';
    return `🦐 ${zoneLabel}${items} · ส่ง ${ship}`;
  }

  const name = data.customerName || 'ลูกค้า';
  const dateLabel = data.deliveryDate ? formatDateThai(data.deliveryDate) : '—';
  const kind = data.deliveryDate ? deliveryDateKind(data.deliveryDate, now) : 'other';
  let shipLine = `ส่ง: ${dateLabel}${data.deliveryDate ? ` (${data.deliveryDate})` : ''}`;
  if (kind === 'today') shipLine = `📅 ส่งวันนี้ — ${dateLabel}`;
  if (kind === 'tomorrow') {
    shipLine = `📅 ส่งพรุ่งนี้ — ${dateLabel} (เลยเวลารับส่งวันนี้)`;
  }
  const items = (data.items || [])
    .map((i) => `• ${i.product} ${i.qty || ''} ${i.unit || ''}`.trim())
    .join('\n');
  const lines = [
    '🦐 ออเดอร์ LINE ใหม่',
    `ลูกค้า: ${name}`,
    shipLine,
  ];
  if (items) lines.push(items);
  if (data.rawText) lines.push(`"${String(data.rawText).slice(0, 80)}"`);
  lines.push('', '— เปิดแอปโกอ้วน → แท็บ LINE');
  return lines.join('\n');
}

function formatTeaRestockMessage(data) {
  const by = data.createdBy || 'พนักงาน';
  const items = (data.items || [])
    .map((i) => {
      const st = i.status === 'out' ? 'หมด' : i.status === 'low' ? 'เหลือน้อย' : '';
      return `• ${i.name} ×${i.qty || 1}${st ? ` (${st})` : ''}`;
    })
    .join('\n');
  const lines = [
    '📦 สั่งของเข้าร้าน (ชินชา)',
    `โดย: ${by}`,
    `วัน: ${data.dateKey || '—'}`,
  ];
  if (items) lines.push(items);
  lines.push('', '— เปิดแอปชินชา → แท็บสั่งของ');
  return lines.join('\n');
}

async function getTeaLineConfig(db) {
  const snap = await db.collection('config').doc('teaLine').get();
  return snap.exists ? snap.data() : {};
}

async function notifyShrimpLineOrder(db, orderData, { orderId = null } = {}) {
  if (!orderData || orderData.status !== 'pending') return { skipped: 'not_pending' };
  const docId = orderId || orderData.id || null;
  if (docId) {
    const snap = await db.collection('lineOrders').doc(docId).get();
    if (snap.exists && snap.data()?.notifySentAt) return { skipped: 'already_sent' };
  }
  const config = await getShrimpLineConfig(db);
  if (config.instantOrderNotify === false) return { skipped: 'disabled' };
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return { skipped: 'no_token' };
  const targets = resolveNotifyTargets(config, orderData);
  if (!targets.size) {
    if (orderData.lineGroupId) return { skipped: 'group_order_no_push' };
    return { skipped: 'no_targets' };
  }
  const notifyGroupId = String(config.notifyGroupId || '').trim();
  const zoneCatalog = await buildCustomerZoneCatalog(db);
  const zone = resolveZoneForOrder(orderData, zoneCatalog);
  const textByTarget = new Map();
  for (const to of targets) {
    const compact = notifyGroupId && to === notifyGroupId;
    textByTarget.set(to, formatShrimpOrderMessage(orderData, new Date(), { compact, zone }));
  }
  const results = [];
  for (const [to, text] of textByTarget) {
    results.push({ to, ok: await linePush(to, text, token) });
  }
  const sent = results.filter((r) => r.ok).length;
  if (docId && sent > 0) {
    try {
      await db.collection('lineOrders').doc(docId).update({
        notifySentAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('notifyShrimpLineOrder notifySentAt', err.message);
    }
  }
  if (sent === 0) {
    console.warn('notifyShrimpLineOrder push failed', docId, results);
  }
  return { sent, targets: results };
}

/** แจ้งทันทีหลังบันทึกออเดอร์ OA/LIFF — ไม่รอ Firestore trigger */
async function notifyShrimpLineOrdersAfterSave(db, orders, { groupId = null } = {}) {
  if (groupId || !orders?.length) return { sent: 0, skipped: groupId ? 'group_order' : 'empty' };
  let totalSent = 0;
  const details = [];
  for (const order of orders) {
    const result = await notifyShrimpLineOrder(db, order, { orderId: order.id });
    details.push({ id: order.id, ...result });
    if (result.sent) totalSent += result.sent;
  }
  return { sent: totalSent, details };
}

function formatShrimpPaymentSlipMessage(slip) {
  const name = slip.customerName || 'ลูกค้า';
  const bill = slip.suggestedBillNo || slip.billNo || '—';
  const amount = slip.remainingAmount ?? slip.total;
  const amountLine = amount != null && Number(amount) > 0
    ? ` · ค้าง ฿${Number(amount).toLocaleString('th-TH')}`
    : '';
  return [
    '💳 สลิปโอนรอตรวจ (LINE OA)',
    `ลูกค้า: ${name}`,
    `บิล: ${bill}${amountLine}`,
    '',
    '— เปิดแอปโกอ้วน → ยอดขาย → แท็บสลิป',
  ].join('\n');
}

function formatShrimpSaleDeleteRequestMessage(alert) {
  const bill = alert.billNo || alert.saleId || '—';
  const name = alert.customerName || '';
  const amount = alert.amount;
  const amountLine = amount != null ? ` · ฿${Number(amount).toLocaleString('th-TH')}` : '';
  const reason = alert.reason ? `\nเหตุผล: ${alert.reason}` : '';
  return [
    '⚠️ แมนเนเจอร์ขอให้ลบบิล',
    `บิล: ${bill}${name ? ` · ${name}` : ''}${amountLine}`,
    `โดย: ${alert.requestedByName || 'แมนเนเจอร์'}${reason}`,
    '',
    '— เปิดแอปโกอ้วน → ยอดขาย → ลบบิล (แอดมิน)',
  ].join('\n');
}

async function notifyShrimpPaymentSlip(db, slipData, { submissionId = null } = {}) {
  if (!slipData || slipData.status !== 'pending') return { skipped: 'not_pending' };
  const config = await getShrimpLineConfig(db);
  if (config.instantSlipNotify === false) return { skipped: 'disabled' };
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return { skipped: 'no_token' };
  const targets = resolveSlipNotifyTargets(config, slipData);
  if (!targets.size) return { skipped: 'no_targets' };
  const text = formatShrimpPaymentSlipMessage(slipData);
  const result = await pushToTargets(targets, text, token);
  if (submissionId && result.sent > 0) {
    try {
      await db.collection('paymentSlipSubmissions').doc(submissionId).update({
        notifySentAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('notifyShrimpPaymentSlip notifySentAt', err.message);
    }
  }
  return result;
}

async function notifyShrimpSaleDeleteRequest(db, alertData, { alertId = null } = {}) {
  if (!alertData || alertData.type !== 'sale_delete_request' || alertData.status !== 'pending') {
    return { skipped: 'not_pending_request' };
  }
  const config = await getShrimpLineConfig(db);
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return { skipped: 'no_token' };
  const targets = collectNotifyTargets(config);
  if (!targets.size) return { skipped: 'no_targets' };
  const text = formatShrimpSaleDeleteRequestMessage(alertData);
  const result = await pushToTargets(targets, text, token);
  if (alertId && result.sent > 0) {
    try {
      await db.collection('shrimpAdminAlerts').doc(alertId).update({
        notifySentAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('notifyShrimpSaleDeleteRequest notifySentAt', err.message);
    }
  }
  return result;
}

async function notifyTeaRestock(db, restockData) {
  if (!restockData || restockData.purchaseStatus === 'purchased') return { skipped: 'purchased' };
  const config = await getTeaLineConfig(db);
  if (config.instantRestockNotify === false) return { skipped: 'disabled' };
  const token = process.env.LINE_TEA_CHANNEL_ACCESS_TOKEN;
  if (!token) return { skipped: 'no_token' };
  const targets = collectNotifyTargets(config);
  if (!targets.size) return { skipped: 'no_targets' };
  const text = formatTeaRestockMessage(restockData);
  return pushToTargets(targets, text, token);
}

module.exports = {
  collectNotifyTargets,
  resolveNotifyTargets,
  resolveSlipNotifyTargets,
  formatShrimpOrderMessage,
  formatShrimpPaymentSlipMessage,
  formatShrimpSaleDeleteRequestMessage,
  formatTeaRestockMessage,
  notifyShrimpLineOrder,
  notifyShrimpLineOrdersAfterSave,
  notifyShrimpPaymentSlip,
  notifyShrimpSaleDeleteRequest,
  notifyTeaRestock,
};
