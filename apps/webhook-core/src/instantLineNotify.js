const { linePush } = require('./teaDailySummary');
const { formatDateThai } = require('./parseDeliveryDate');

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

async function pushToTargets(targets, text, token) {
  if (!token || !text || !targets.size) return { sent: 0, targets: [] };
  const results = [];
  for (const to of targets) {
    results.push({ to, ok: await linePush(to, text, token) });
  }
  return { sent: results.filter((r) => r.ok).length, targets: results };
}

function formatShrimpOrderMessage(data) {
  const name = data.customerName || 'ลูกค้า';
  const dateLabel = data.deliveryDate ? formatDateThai(data.deliveryDate) : '—';
  const items = (data.items || [])
    .map((i) => `• ${i.product} ${i.qty || ''} ${i.unit || ''}`.trim())
    .join('\n');
  const lines = [
    '🦐 ออเดอร์ LINE ใหม่',
    `ลูกค้า: ${name}`,
    `ส่ง: ${dateLabel}${data.deliveryDate ? ` (${data.deliveryDate})` : ''}`,
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

async function getShrimpLineConfig(db) {
  const snap = await db.collection('config').doc('shrimpLine').get();
  return snap.exists ? snap.data() : {};
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
  const targets = collectNotifyTargets(config);
  if (!targets.size) return { skipped: 'no_targets' };
  const text = formatShrimpOrderMessage(orderData);
  return pushToTargets(targets, text, token);
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
  formatShrimpOrderMessage,
  formatTeaRestockMessage,
  notifyShrimpLineOrder,
  notifyTeaRestock,
};
