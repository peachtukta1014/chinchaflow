/** สรุปยอดขายรายวันร้านชา → ข้อความ LINE */

function todayBKK() {
  return new Date(Date.now() + 7 * 3600000).toISOString().split('T')[0];
}

function formatMoney(n) {
  return `฿${Math.round(n || 0).toLocaleString('th-TH')}`;
}

function createdOnDateKey(createdAt, dateKey) {
  if (!createdAt) return false;
  let iso = '';
  if (typeof createdAt === 'string') iso = createdAt;
  else if (createdAt.toDate) iso = createdAt.toDate().toISOString();
  else if (createdAt._seconds) iso = new Date(createdAt._seconds * 1000).toISOString();
  return iso.startsWith(dateKey);
}

const STATUS_LABEL = { out: 'หมด', low: 'เหลือน้อย', normal: 'ปกติ' };

async function getTeaLineConfig(db) {
  const snap = await db.collection('config').doc('teaLine').get();
  return snap.exists ? snap.data() : {};
}

async function fetchDayData(db, dateKey) {
  const [ordersSnap, expensesSnap, restocksSnap] = await Promise.all([
    db.collection('teaOrders').where('dateKey', '==', dateKey).get(),
    db.collection('dailyExpenses').where('dateKey', '==', dateKey).get(),
    db.collection('restocks').where('dateKey', '==', dateKey).get(),
  ]);

  const orders = ordersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const expenses = expensesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const restocks = restocksSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return { orders, expenses, restocks };
}

function aggregateDay({ orders, expenses, restocks }) {
  const cashOrders = orders.filter((o) => !o.payType || o.payType === 'cash');
  const transferOrders = orders.filter((o) => o.payType === 'transfer');
  const totalSales = orders.reduce((s, o) => s + (o.total || 0), 0);
  const cashTotal = cashOrders.reduce((s, o) => s + (o.total || 0), 0);
  const transferTotal = transferOrders.reduce((s, o) => s + (o.total || 0), 0);
  const allItems = orders.flatMap((o) => o.items || []);
  const totalCups = allItems.reduce((s, i) => s + (i.qty || 1), 0);
  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  let totalRestockPurchased = 0;
  const restockLines = [];
  const restockPurchasedLines = [];
  for (const req of restocks) {
    const bought = req.purchaseStatus === 'purchased' && Number(req.purchaseTotal) > 0;
    const by = req.purchasedBy || req.createdBy || '';
    if (bought) {
      totalRestockPurchased += Math.round(Number(req.purchaseTotal));
      const pricedItems = Array.isArray(req.purchaseItems)
        ? req.purchaseItems
          .filter((it) => it && Number(it.lineTotal) > 0)
          .map((it) => `${it.name || 'รายการ'} ${formatMoney(it.lineTotal)}${Number(it.unitPrice) > 0 ? ` (${formatMoney(it.unitPrice)}/ชิ้น)` : ''}`)
        : [];
      const names = pricedItems.length
        ? pricedItems.join(', ')
        : ((req.items || []).map((it) => it.name).filter(Boolean).join(', ') || 'รายการ');
      restockPurchasedLines.push(`• ${names} รวม ${formatMoney(req.purchaseTotal)}${by ? ` — ${by}` : ''}`);
    }
    for (const it of req.items || []) {
      const st = STATUS_LABEL[it.status] || it.status || '';
      const boughtTag = bought ? ' (ซื้อแล้ว)' : '';
      restockLines.push(`• ${it.name} ×${it.qty || 1}${st ? ` (${st})` : ''}${boughtTag}`);
    }
  }
  const net = totalSales - totalExpenses - totalRestockPurchased;

  return {
    orderCount: orders.length,
    totalCups,
    totalSales,
    cashTotal,
    transferTotal,
    totalExpenses,
    totalRestockPurchased,
    net,
    expenseLines: expenses.map((e) => `• ${e.description} ${formatMoney(e.amount)}`),
    restockLines,
    restockPurchasedLines,
  };
}

function formatSummaryMessage(dateKey, agg) {
  const lines = [
    '📊 สรุปปิดวัน — ชินชา',
    `📅 ${dateKey}`,
    '',
    `💰 ยอดขายรวม: ${formatMoney(agg.totalSales)}`,
    `   💵 สด: ${formatMoney(agg.cashTotal)}`,
    `   📱 โอน: ${formatMoney(agg.transferTotal)}`,
    `🧋 ขายได้ ${agg.totalCups} แก้ว (${agg.orderCount} ออเดอร์)`,
    '',
    `💸 ค่าใช้จ่ายร้าน: ${formatMoney(agg.totalExpenses)}`,
  ];

  if (agg.expenseLines.length) {
    lines.push(...agg.expenseLines.slice(0, 12));
    if (agg.expenseLines.length > 12) lines.push(`   … และอีก ${agg.expenseLines.length - 12} รายการ`);
  } else {
    lines.push('   (ไม่มีบันทึกค่าใช้จ่าย)');
  }

  lines.push('');
  lines.push(`📦 ซื้อของเข้าร้าน (ซื้อแล้ว): ${formatMoney(agg.totalRestockPurchased)}`);
  if (agg.restockPurchasedLines.length) {
    lines.push(...agg.restockPurchasedLines.slice(0, 12));
  } else {
    lines.push('   (ยังไม่บันทึกยอดซื้อในแอป)');
  }
  lines.push('');
  lines.push(`✅ กำไรคร่าวๆ: ${formatMoney(agg.net)}`);
  lines.push('   (ยอดขาย − ค่าใช้จ่าย − ซื้อของที่ซื้อแล้ว)');
  lines.push('');
  lines.push('📋 รายการสั่งของ (ทั้งหมด):');

  if (agg.restockLines.length) {
    lines.push(...agg.restockLines.slice(0, 20));
    if (agg.restockLines.length > 20) lines.push(`   … และอีก ${agg.restockLines.length - 20} รายการ`);
  } else {
    lines.push('   (ไม่มีรายการสั่งของวันนี้)');
  }

  lines.push('');
  lines.push('— บันทึกจากแอปชินชา (พนักงาน) —');

  const text = lines.join('\n');
  return text.length > 4800 ? `${text.slice(0, 4790)}…` : text;
}

async function buildSummaryForDate(db, dateKey) {
  const data = await fetchDayData(db, dateKey);
  const agg = aggregateDay(data);
  return formatSummaryMessage(dateKey, agg);
}

/** ข้อความเฉพาะรายการสั่งของ / ซื้อเข้าร้าน (คำสั่ง LINE แยกจากสรุปปิดวัน) */
function formatRestockPurchaseMessage(dateKey, agg) {
  const lines = [
    '📦 ซื้อเข้าร้าน — ชินชา',
    `📅 ${dateKey}`,
    '',
    `💰 ยอดซื้อแล้วรวม: ${formatMoney(agg.totalRestockPurchased)}`,
  ];

  if (agg.restockPurchasedLines.length) {
    lines.push('', '🛒 บันทึกว่าซื้อแล้ว:');
    lines.push(...agg.restockPurchasedLines.slice(0, 15));
    if (agg.restockPurchasedLines.length > 15) {
      lines.push(`   … และอีก ${agg.restockPurchasedLines.length - 15} ใบ`);
    }
  } else {
    lines.push('', '🛒 (ยังไม่มีใบที่กด「ซื้อแล้ว」ในแอป)');
  }

  lines.push('');
  lines.push('📋 รายการสั่งของวันนี้:');
  if (agg.restockLines.length) {
    lines.push(...agg.restockLines.slice(0, 25));
    if (agg.restockLines.length > 25) lines.push(`   … และอีก ${agg.restockLines.length - 25} รายการ`);
  } else {
    lines.push('   (ยังไม่มีรายการสั่งของวันนี้)');
  }

  lines.push('');
  lines.push('— บันทึกจากแอปชินชา (แท็บสั่งของ) —');

  const text = lines.join('\n');
  return text.length > 4800 ? `${text.slice(0, 4790)}…` : text;
}

async function buildRestockPurchaseForDate(db, dateKey) {
  const data = await fetchDayData(db, dateKey);
  const agg = aggregateDay(data);
  return formatRestockPurchaseMessage(dateKey, agg);
}

async function linePush(to, text, token) {
  if (!token || !to) return false;
  try {
    const r = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to, messages: [{ type: 'text', text }] }),
    });
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      console.error('linePush failed', r.status, to, body.slice(0, 300));
    }
    return r.ok;
  } catch (err) {
    console.error('linePush error', to, err.message);
    return false;
  }
}

async function lineReply(replyToken, text, token) {
  if (!token || !replyToken) return;
  try {
    await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] }),
    });
  } catch { /* best-effort */ }
}

/** ส่งสรุปไปยังกลุ่ม/ผู้รับที่ตั้งใน config/teaLine */
async function dispatchTeaSummary(db, dateKey, token, { force = false } = {}) {
  const config = await getTeaLineConfig(db);
  if (!force && config.autoSummaryEnabled === false) {
    return { message: '', results: [], targetCount: 0, skipped: 'disabled' };
  }
  if (!force && config.lastAutoSummaryDateKey === dateKey) {
    return { message: '', results: [], targetCount: 0, skipped: 'already_sent' };
  }
  const message = await buildSummaryForDate(db, dateKey);
  const targets = new Set();

  if (config.notifyGroupId) targets.add(config.notifyGroupId.trim());
  const extra = config.notifyUserIds;
  if (typeof extra === 'string') {
    extra.split(/[,;\s]+/).filter(Boolean).forEach((id) => targets.add(id));
  } else if (Array.isArray(extra)) {
    extra.filter(Boolean).forEach((id) => targets.add(String(id).trim()));
  }

  const results = [];
  for (const to of targets) {
    results.push({ to, ok: await linePush(to, message, token) });
  }
  if (targets.size > 0 && results.some((r) => r.ok)) {
    await db.collection('config').doc('teaLine').set(
      { lastAutoSummaryDateKey: dateKey, lastAutoSummaryAt: new Date().toISOString() },
      { merge: true },
    );
  }
  return { message, results, targetCount: targets.size };
}

const HELP_TEXT = [
  '🤖 บอทแจ้งสรุป — ชินชา',
  '',
  'แอปนี้สำหรับพนักงานบันทึกยอดขายรายวัน',
  'ไม่ใช่รับออเดอร์ลูกค้า',
  '',
  'คำสั่ง:',
  '• สรุป / สรุปวันนี้ / ปิดวัน / ยอดขายวันนี้',
  '   → สรุปยอดขาย สด/โอน แก้ว ค่าใช้จ่าย สั่งของ',
  '• ซื้อเข้าร้าน / ซื้อของ / restock',
  '   → รายการสั่งของวันนี้ + ยอดที่ซื้อแล้ว',
  '• help / ช่วยเหลือ / คำสั่ง / menu',
  '',
  'คีย์ลัด (กลุ่มร้านน้ำ):',
  '• 1 → สรุปวันนี้',
  '• 2 → ซื้อเข้าร้าน',
  '• 3 หรือ help → คำสั่งนี้',
  '',
  'สรุปอัตโนมัติตามเวลาที่แอดมินตั้งในแอป',
].join('\n');

const SUMMARY_CMD = /^(สรุป|สรุปวันนี้|ปิดวัน|ยอดขาย|ยอดขายวันนี้|summary|daily|รายงาน)(\s|$)/i;
const RESTOCK_PURCHASE_CMD = /^(ซื้อเข้าร้าน|ซื้อของเข้าร้าน|ซื้อของ|restock|buy[\s-]?in)(\s|$)/i;
const HELP_CMD = /^(help|ช่วยเหลือ|ช่วย|คำสั่ง|menu|เมนู|คีย์|\?|h)(\s|$)/i;

/** จำแนกคำสั่งข้อความ LINE ชา — รวมคีย์ลัดตัวเลข */
function classifyTeaLineCommand(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  if (/^1$/.test(raw)) return 'summary';
  if (/^2$/.test(raw)) return 'restock';
  if (/^3$/.test(raw)) return 'help';
  if (HELP_CMD.test(raw)) return 'help';
  if (SUMMARY_CMD.test(raw)) return 'summary';
  if (RESTOCK_PURCHASE_CMD.test(raw)) return 'restock';
  if (/ยอดขาย.*(วันนี้|สรุป)|(สรุป|ปิดวัน).*ยอดขาย/i.test(raw)) return 'summary';
  return null;
}

function isTeaLineCommand(text) {
  return classifyTeaLineCommand(text) != null;
}

module.exports = {
  todayBKK,
  getTeaLineConfig,
  buildSummaryForDate,
  buildRestockPurchaseForDate,
  dispatchTeaSummary,
  lineReply,
  linePush,
  HELP_TEXT,
  SUMMARY_CMD,
  RESTOCK_PURCHASE_CMD,
  HELP_CMD,
  classifyTeaLineCommand,
  isTeaLineCommand,
};
