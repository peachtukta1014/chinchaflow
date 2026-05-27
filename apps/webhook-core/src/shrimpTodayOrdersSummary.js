/**
 * สรุปออเดอร์ LINE ที่ต้องจัดส่งวันนี้ (และค้างส่งที่ยัง pending)
 */

const { todayBKK, formatDateThai } = require('./parseDeliveryDate');

const ORDER_WORD_RE = /(?:ออ[ร์]*เดอร?์?|ออเดอร์|order)/i;

function isShrimpTodayOrdersCommand(text) {
  const raw = String(text || '').trim();
  if (!raw) return false;
  if (!ORDER_WORD_RE.test(raw)) return false;
  if (!/(วันนี้|today)/i.test(raw)) return false;
  if (/^(?:ออ[ร์]*เดอร?์?|ออเดอร์|order)\s*วันนี้\s*รวม?$/i.test(raw)) return true;
  if (/(รวม|สรุป|ทั้งหมด|เช็ค|ตรวจ|list)/i.test(raw)) return true;
  return false;
}

function formatItemsLines(items) {
  return (items || [])
    .map((it) => {
      const who = it.customerName ? `${it.customerName} · ` : '';
      return `   • ${who}${it.product || '—'} ${it.qty ?? ''} ${it.unit || ''}`.trim();
    })
    .join('\n');
}

function aggregateByProduct(orders) {
  const totals = {};
  for (const o of orders) {
    for (const it of o.items || []) {
      const key = `${it.product || '—'}|${it.unit || 'กก'}`;
      totals[key] = (totals[key] || 0) + (parseFloat(it.qty) || 0);
    }
  }
  return Object.entries(totals)
    .map(([k, qty]) => {
      const [product, unit] = k.split('|');
      return `   • ${product} ${qty} ${unit}`;
    })
    .join('\n');
}

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} [dateKey] — วันส่งที่ถือเป็น "วันนี้" (default Bangkok today)
 */
async function buildShrimpTodayOrdersSummary(db, dateKey = todayBKK()) {
  let snap;
  try {
    snap = await db
      .collection('lineOrders')
      .where('status', '==', 'pending')
      .where('deliveryDate', '<=', dateKey)
      .orderBy('deliveryDate', 'asc')
      .get();
  } catch (err) {
    console.warn('today orders query', err.message);
    const all = await db.collection('lineOrders').where('status', '==', 'pending').limit(200).get();
    const docs = all.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((o) => (o.deliveryDate || '') <= dateKey)
      .sort((a, b) => String(a.deliveryDate).localeCompare(String(b.deliveryDate)));
    return formatTodayOrdersReply(docs, dateKey);
  }

  const orders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return formatTodayOrdersReply(orders, dateKey);
}

function formatTodayOrdersReply(orders, dateKey) {
  const overdue = orders.filter((o) => (o.deliveryDate || '') < dateKey);
  const dueToday = orders.filter((o) => (o.deliveryDate || '') === dateKey);

  const lines = [
    '📦 ออเดอร์ส่งวันนี้ — โกอ้วน คลังซีฟู้ด',
    `📅 ${formatDateThai(dateKey)} (${dateKey})`,
    '',
  ];

  if (orders.length === 0) {
    lines.push('ยังไม่มีออเดอร์รอส่งวันนี้ครับ');
    lines.push('สั่งผ่าน LINE ได้ตามปกติ · พิมพ์คำสั่งนี้ซ้ำเมื่อต้องการเช็ค');
    return lines.join('\n');
  }

  lines.push(`รวม ${orders.length} ออเดอร์รอจัดส่ง`);
  if (overdue.length > 0) {
    lines.push(`⚠️ ค้างส่ง ${overdue.length} ออเดอร์ (เลยวันที่กำหนด)`);
  }
  if (dueToday.length > 0) {
    lines.push(`🚚 กำหนดส่งวันนี้ ${dueToday.length} ออเดอร์`);
  }
  lines.push('');

  orders.forEach((o, idx) => {
    const label = o.customerName || (o.rawText ? o.rawText.slice(0, 24) : `ออเดอร์ ${idx + 1}`);
    const late = (o.deliveryDate || '') < dateKey;
    const dateNote = late
      ? ` ⚠️ค้าง (กำหนด ${formatDateThai(o.deliveryDate)})`
      : '';
    lines.push(`${idx + 1}. ${label}${dateNote}`);
    lines.push(formatItemsLines(o.items));
    if (o.rawText && o.customerName) {
      lines.push(`   「${String(o.rawText).slice(0, 60)}」`);
    }
    lines.push('');
  });

  lines.push('— รวมน้ำหนัก/รายการ —');
  lines.push(aggregateByProduct(orders) || '   (ไม่มีรายการ)');
  lines.push('');
  lines.push('— จากออเดอร์ LINE ในระบบ · ส่งเรียบร้อยในแอปแท็บออเดอร์');

  return lines.join('\n');
}

module.exports = {
  buildShrimpTodayOrdersSummary,
  isShrimpTodayOrdersCommand,
};
