/** สรุปยอดขายรายวันร้านชา → ข้อความ LINE (shared copy for scheduled codebase) */

function todayBKK() {
  return new Date(Date.now() + 7 * 3600000).toISOString().split('T')[0];
}

function formatMoney(n) {
  return `฿${Math.round(n || 0).toLocaleString('th-TH')}`;
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
    if (bought) {
      totalRestockPurchased += Math.round(Number(req.purchaseTotal));
      const names = (req.items || []).map((it) => it.name).filter(Boolean).join(', ') || 'รายการ';
      restockPurchasedLines.push(`• ${names} ${formatMoney(req.purchaseTotal)}`);
    }
    for (const it of req.items || []) {
      const st = STATUS_LABEL[it.status] || it.status || '';
      restockLines.push(`• ${it.name} ×${it.qty || 1}${st ? ` (${st})` : ''}`);
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

async function linePush(to, text, token) {
  if (!token || !to) return false;
  try {
    const r = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to, messages: [{ type: 'text', text }] }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

async function dispatchTeaSummary(db, dateKey, token) {
  const config = await getTeaLineConfig(db);
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
  return { message, results, targetCount: targets.size };
}

module.exports = {
  todayBKK,
  getTeaLineConfig,
  dispatchTeaSummary,
};
