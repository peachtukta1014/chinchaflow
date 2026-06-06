const { linePush } = require('./teaDailySummary');
const { formatDateThai, deliveryDateKind } = require('./parseDeliveryDate');
const { getShrimpLineConfig } = require('./shrimpLineConfig');
const { formatOrderCompactLine } = require('./shrimpTodayOrdersSummary');

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

function formatShrimpOrderMessage(data, now = new Date(), { compact = false } = {}) {
  if (compact) {
    const items = formatOrderCompactLine(data);
    const dateLabel = data.deliveryDate ? formatDateThai(data.deliveryDate) : '—';
    const kind = data.deliveryDate ? deliveryDateKind(data.deliveryDate, now) : 'other';
    let ship = dateLabel;
    if (kind === 'today') ship = `วันนี้ ${dateLabel}`;
    else if (kind === 'tomorrow') ship = `พรุ่งนี้ ${dateLabel}`;
    return `🦐 ${items} · ส่ง ${ship}`;
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

async function notifyShrimpLineOrder(db, orderData) {
  if (!orderData || orderData.status !== 'pending') return { skipped: 'not_pending' };
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
  const textByTarget = new Map();
  for (const to of targets) {
    const compact = notifyGroupId && to === notifyGroupId;
    textByTarget.set(to, formatShrimpOrderMessage(orderData, new Date(), { compact }));
  }
  const results = [];
  for (const [to, text] of textByTarget) {
    results.push({ to, ok: await linePush(to, text, token) });
  }
  return { sent: results.filter((r) => r.ok).length, targets: results };
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
  formatShrimpOrderMessage,
  formatTeaRestockMessage,
  notifyShrimpLineOrder,
  notifyTeaRestock,
};
