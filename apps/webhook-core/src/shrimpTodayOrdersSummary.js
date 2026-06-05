/**
 * สรุปออเดอร์ LINE ที่ต้องจัดส่งวันนี้ (และค้างส่งที่ยัง pending)
 */

const { todayBKK, formatDateThai } = require('./parseDeliveryDate');
const {
  buildCustomerNameByLineUidMap,
  normalizeLineUserId,
} = require('./shrimpLinePush');
const { customerMatchesName } = require('./customerNameAliases');

const ORDER_WORD_RE = /(?:ออ[ร์]*เดอร?์?|ออเดอร์|order)/i;

/** ลำดับแสดงโซนในกลุ่มครอบครัว */
const ZONE_DISPLAY_ORDER = ['ป่าตอง', 'กะทู้', 'ภูเก็ต', 'ราไวย์', 'ทั่วไป'];

function isShrimpTodayOrdersCommand(text) {
  const raw = String(text || '').trim();
  if (!raw) return false;

  if (/^สรุป.*(ออเดอร์|order|รายการ)/i.test(raw)) return true;
  if (/^สรุปรายการวันนี้/i.test(raw)) return true;
  if (/^รายการ.*(วันนี้|ออเดอร์)/i.test(raw)) return true;

  if (!ORDER_WORD_RE.test(raw)) return false;
  if (!/(วันนี้|today)/i.test(raw)) return false;
  if (/^(?:ออ[ร์]*เดอร?์?|ออเดอร์|order)\s*วันนี้\s*รวม?$/i.test(raw)) return true;
  if (/(รวม|สรุป|ทั้งหมด|เช็ค|ตรวจ|list)/i.test(raw)) return true;
  return false;
}

async function cancelLatestPendingOrderForUser(db, lineUserId) {
  if (!lineUserId) return { cancelled: null, message: 'ไม่พบข้อมูลผู้ใช้ครับ' };

  let snap;
  try {
    snap = await db
      .collection('lineOrders')
      .where('lineUserId', '==', lineUserId)
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'desc')
      .limit(2)
      .get();
  } catch (err) {
    console.warn('cancelLatestPendingOrderForUser query', err.message);
    const fallback = await db
      .collection('lineOrders')
      .where('lineUserId', '==', lineUserId)
      .where('status', '==', 'pending')
      .limit(10)
      .get();
    snap = {
      empty: fallback.empty,
      docs: fallback.docs.sort((a, b) => {
        const ta = a.data().createdAt;
        const tb = b.data().createdAt;
        if (!ta || !tb) return 0;
        return String(tb).localeCompare(String(ta));
      }),
    };
  }

  if (snap.empty || snap.docs.length === 0) {
    return { cancelled: null, message: 'ไม่พบออเดอร์รอจัดส่งของคุณในระบบครับ\nถ้าเพิ่งสั่งไปลองตรวจสอบอีกครั้ง หรือแจ้งพนักงานโดยตรงครับ' };
  }

  const target = snap.docs[0];
  const data = target.data();
  await target.ref.update({
    status: 'cancelled',
    cancelledAt: new Date().toISOString(),
    cancelledBy: 'customer_line',
  });

  const itemLines = (data.items || [])
    .map((it) => {
      const who = it.customerName ? `${it.customerName} · ` : '';
      return `• ${who}${it.product || '—'} ${it.qty ?? ''} ${it.unit || 'กก'}`.trim();
    })
    .join('\n');

  const dateLabel = data.deliveryDate ? ` (ส่ง ${formatDateThai(data.deliveryDate)})` : '';

  let pending = 0;
  try {
    const countSnap = await db
      .collection('lineOrders')
      .where('lineUserId', '==', lineUserId)
      .where('status', '==', 'pending')
      .count()
      .get();
    pending = countSnap.data().count;
  } catch {
    pending = Math.max(0, snap.docs.length - 1);
  }

  const moreNote = pending > 0 ? `\n\nยังมีออเดอร์รอส่ง ${pending} รายการในระบบ\nถ้าต้องการยกเลิกเพิ่มพิมพ์ "ยกเลิก" อีกครั้งครับ` : '';

  return {
    cancelled: { id: target.id, ...data },
    message: `✅ ยกเลิกออเดอร์แล้วครับ${dateLabel}\n\n${itemLines || '(ไม่มีรายการ)'}${moreNote}`,
  };
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

function enrichOrdersWithLinkedCustomers(orders, uidMap) {
  return orders.map((o) => {
    const uid = normalizeLineUserId(o?.lineUserId);
    const synced = uid && uidMap?.get(uid);
    if (!synced) return o;
    const items = (o.items || []).map((it) => ({
      ...it,
      customerName: synced,
    }));
    return { ...o, customerName: synced, items };
  });
}

/** ชื่อสั้นสำหรับแสดงในกลุ่ม — ตัดคำว่า ร้าน / ส่วนหลัง comma */
function formatCustomerShortName(name) {
  let s = String(name || '—').trim();
  if (/^ร้าน\s+/.test(s)) s = s.replace(/^ร้าน\s+/, '').trim();
  const comma = s.search(/[,，、]/);
  if (comma > 0) s = s.slice(0, comma).trim();
  return s || '—';
}

function sizeLabelFromProduct(product) {
  const p = String(product || '');
  if (/ตาย|dead/i.test(p)) return 'ตาย';
  if (/ใหญ่|large|\ba\b/i.test(p)) return 'ใหญ่';
  if (/กลาง|medium|\bb\b/i.test(p)) return 'กลาง';
  if (/เล็ก|small|\bc\b/i.test(p)) return 'เล็ก';
  return '—';
}

function sizeLabelToGradeKey(sizeLabel) {
  if (sizeLabel === 'ใหญ่') return 'large';
  if (sizeLabel === 'กลาง') return 'medium';
  if (sizeLabel === 'เล็ก') return 'small';
  return null;
}

function qtyToKg(qty) {
  return parseFloat(qty) || 0;
}

function zoneSortIndex(zone) {
  const z = String(zone || 'ทั่วไป').trim() || 'ทั่วไป';
  const i = ZONE_DISPLAY_ORDER.indexOf(z);
  if (i >= 0) return i;
  return ZONE_DISPLAY_ORDER.length + 1;
}

async function buildCustomerZoneResolver(db) {
  const snap = await db.collection('customers').get();
  const records = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return (customerName) => {
    const want = String(customerName || '').trim();
    if (!want) return 'ทั่วไป';
    for (const rec of records) {
      if (customerMatchesName(rec, want)) {
        return String(rec.zone || 'ทั่วไป').trim() || 'ทั่วไป';
      }
    }
    return 'ทั่วไป';
  };
}

/**
 * รวมรายการตามโซน + ลูกค้า + ไซซ์ (กก.)
 * @returns {{ rows: Array, gradeKg: { large, medium, small } }}
 */
function collectFamilyOrderRows(orders, dateKey, resolveZone) {
  const merged = new Map();
  const gradeKg = { large: 0, medium: 0, small: 0 };

  for (const o of orders) {
    const late = (o.deliveryDate || '') < dateKey;
    for (const it of o.items || []) {
      const customerName = formatCustomerShortName(it.customerName || o.customerName);
      const zone = resolveZone(customerName);
      const sizeLabel = sizeLabelFromProduct(it.product);
      const qtyKg = qtyToKg(it.qty);
      const gradeKey = sizeLabelToGradeKey(sizeLabel);
      if (gradeKey) gradeKg[gradeKey] += qtyKg;

      const key = `${zone}|${customerName}|${sizeLabel}`;
      const prev = merged.get(key);
      if (prev) {
        prev.qtyKg += qtyKg;
        prev.late = prev.late || late;
      } else {
        merged.set(key, { zone, customerName, sizeLabel, qtyKg, late });
      }
    }
  }

  const rows = [...merged.values()].sort((a, b) => {
    const z = zoneSortIndex(a.zone) - zoneSortIndex(b.zone);
    if (z !== 0) return z;
    const n = a.customerName.localeCompare(b.customerName, 'th');
    if (n !== 0) return n;
    return a.sizeLabel.localeCompare(b.sizeLabel, 'th');
  });

  return { rows, gradeKg };
}

function formatFamilyTodayOrdersReply(orders, dateKey, resolveZone) {
  const lines = [
    'รายการออเดอร์ลูกค้า',
    `วันที่ ${formatDateThai(dateKey)}`,
    '',
  ];

  if (orders.length === 0) {
    lines.push('ยังไม่มีออเดอร์รอส่งวันนี้ครับ');
    return lines.join('\n');
  }

  const overdue = orders.filter((o) => (o.deliveryDate || '') < dateKey);
  if (overdue.length > 0) {
    lines.push(`⚠️ ค้างส่ง ${overdue.length} ออเดอร์`);
    lines.push('');
  }

  const { rows, gradeKg } = collectFamilyOrderRows(orders, dateKey, resolveZone);

  const byZone = new Map();
  for (const row of rows) {
    if (!byZone.has(row.zone)) byZone.set(row.zone, []);
    byZone.get(row.zone).push(row);
  }
  const zones = [...byZone.keys()].sort((a, b) => zoneSortIndex(a) - zoneSortIndex(b));

  zones.forEach((zone, zi) => {
    if (zi > 0) lines.push('');
    lines.push(zone);
    const zoneRows = byZone.get(zone);
    const nameWidth = Math.max(...zoneRows.map((r) => r.customerName.length), 4);
    for (const row of zoneRows) {
      const name = row.customerName.padEnd(nameWidth, ' ');
      const lateMark = row.late ? ' ⚠️' : '';
      const qtyStr = row.qtyKg % 1 === 0 ? String(row.qtyKg) : row.qtyKg.toFixed(1);
      lines.push(`${name}  ${row.sizeLabel} ${qtyStr} กก.${lateMark}`);
    }
  });

  const totalKg = gradeKg.large + gradeKg.medium + gradeKg.small;
  lines.push('');
  lines.push('ยอดรวมทั้งหมด');
  lines.push(`A=${gradeKg.large.toFixed(1)}KG`);
  lines.push(`B=${gradeKg.medium.toFixed(1)}KG`);
  lines.push(`C=${gradeKg.small.toFixed(1)}KG`);
  lines.push(`รวม ${totalKg.toFixed(1)}KG`);

  return lines.join('\n');
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

async function buildShrimpTodayOrdersSummary(db, dateKey = todayBKK(), { familyGroup = false } = {}) {
  const uidMap = await buildCustomerNameByLineUidMap(db);
  const resolveZone = familyGroup ? await buildCustomerZoneResolver(db) : null;

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
    const orders = enrichOrdersWithLinkedCustomers(
      all.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((o) => (o.deliveryDate || '') <= dateKey)
        .sort((a, b) => String(a.deliveryDate).localeCompare(String(b.deliveryDate))),
      uidMap,
    );
    if (familyGroup && resolveZone) {
      return formatFamilyTodayOrdersReply(orders, dateKey, resolveZone);
    }
    return formatTodayOrdersReply(orders, dateKey);
  }

  const orders = enrichOrdersWithLinkedCustomers(
    snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    uidMap,
  );

  if (familyGroup && resolveZone) {
    return formatFamilyTodayOrdersReply(orders, dateKey, resolveZone);
  }
  return formatTodayOrdersReply(orders, dateKey);
}

module.exports = {
  buildShrimpTodayOrdersSummary,
  isShrimpTodayOrdersCommand,
  cancelLatestPendingOrderForUser,
  formatCustomerShortName,
  sizeLabelFromProduct,
  collectFamilyOrderRows,
  formatFamilyTodayOrdersReply,
  ZONE_DISPLAY_ORDER,
};
