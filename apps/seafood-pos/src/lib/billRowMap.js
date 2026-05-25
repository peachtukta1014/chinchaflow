/** รองรับทั้ง cart (weight/total) และ Firestore (weightKg/lineTotal) */
export function normalizeLineItem(item) {
  const weight = parseFloat(item.weightKg ?? item.weight ?? 0) || 0;
  const total = parseFloat(item.lineTotal ?? item.total ?? 0) || 0;
  const pricePerKg = parseFloat(item.pricePerKg ?? 0) || 0;
  const type = item.type || (item.productId === 'dead' ? 'dead' : 'live');
  return {
    productName: item.productName || '',
    type,
    weight,
    total,
    pricePerKg,
    note: item.note || '',
  };
}

/**
 * แถวในตารางบิล (นับจากแถวแรกใต้หัวตาราง) — ตรงฟอร์มพิมพ์
 * กุ้งแม่น้ำ A / B / C และกุ้งตายใหญ่ / เล็ก
 */
export const BILL_PRINTED_ROWS = {
  large: 1,
  medium: 2,
  small: 3,
  dead_large: 5,
  dead_small: 6,
};

/** แถวที่มีชื่อสินค้าพิมพ์ไว้แล้ว — วาดแค่ จำนวน / หน่วยละ / จำนวนเงิน */
export function isPreprintedProductRow(rowIndex) {
  return Object.values(BILL_PRINTED_ROWS).includes(rowIndex);
}

export function resolveBillRowIndex(item) {
  const row = normalizeLineItem(item);
  const productId = item.productId || item.id;

  if (productId === 'large') return BILL_PRINTED_ROWS.large;
  if (productId === 'medium') return BILL_PRINTED_ROWS.medium;
  if (productId === 'small') return BILL_PRINTED_ROWS.small;

  if (productId === 'dead' || row.type === 'dead') {
    const n = `${row.productName} ${row.note}`.toLowerCase();
    if (/เล็ก|\bsmall\b|\bc\b|,c/.test(n)) return BILL_PRINTED_ROWS.dead_small;
    if (/ใหญ่|\blarge\b|\ba\b|,a/.test(n)) return BILL_PRINTED_ROWS.dead_large;
    return BILL_PRINTED_ROWS.dead_large;
  }

  const name = `${row.productName} ${row.note}`;
  if (/ใหญ่|,?\s*A\b|กุ้งแม่น้ำ\s*A/i.test(name)) return BILL_PRINTED_ROWS.large;
  if (/กลาง|,?\s*B\b|กุ้งแม่น้ำ\s*B/i.test(name)) return BILL_PRINTED_ROWS.medium;
  if (/เล็ก|,?\s*C\b|กุ้งแม่น้ำ\s*C/i.test(name)) return BILL_PRINTED_ROWS.small;
  if (/ตาย.*เล็ก/i.test(name)) return BILL_PRINTED_ROWS.dead_small;
  if (/ตาย.*ใหญ่/i.test(name)) return BILL_PRINTED_ROWS.dead_large;
  if (/ตาย/i.test(name)) return BILL_PRINTED_ROWS.dead_large;

  return null;
}

/** จัดรายการลงแถวฟอร์ม + รายการพิเศษที่ไม่ตรงแถวพิมพ์ */
export function groupBillItemsByRow(items) {
  const byRow = new Map();
  const overflow = [];

  for (const raw of items || []) {
    const idx = resolveBillRowIndex(raw);
    if (idx == null) {
      overflow.push(raw);
      continue;
    }
    if (!byRow.has(idx)) {
      byRow.set(idx, raw);
      continue;
    }
    const prev = normalizeLineItem(byRow.get(idx));
    const next = normalizeLineItem(raw);
    byRow.set(idx, {
      ...byRow.get(idx),
      weightKg: prev.weight + next.weight,
      lineTotal: prev.total + next.total,
      weight: prev.weight + next.weight,
      total: prev.total + next.total,
    });
  }

  return { byRow, overflow };
}
