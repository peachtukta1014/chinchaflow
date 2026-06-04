/** คีย์เอกสาร customerDebts — รองรับลูกค้าที่ยังเป็น general แต่มีชื่อจริง */
export function debtCustomerKey(customerId, customerName) {
  if (customerId && customerId !== 'general') return customerId;
  const name = (customerName || '').trim();
  if (!name) return null;
  const slug = name.replace(/\s+/g, '').toLowerCase();
  return `cust_${slug}`;
}

/** รวมลูกค้าที่มียอดค้าง — customerDebts + บิล sales ที่ยังไม่ขึ้นเอกสารหนี้ */
export function buildDebtCustomerRows(customerDebts = [], openSales = []) {
  const map = new Map();

  for (const d of customerDebts) {
    const debt = parseFloat(d.totalDebt) || 0;
    if (debt <= 0) continue;
    map.set(d.id, {
      key: d.id,
      customerId: d.customerId || d.id,
      customerName: d.customerName || 'ลูกค้า',
      zone: d.zone || 'ทั่วไป',
      totalDebt: debt,
    });
  }

  const salesRemainByKey = new Map();
  for (const s of openSales) {
    const remain = parseFloat(s.remainingAmount) || 0;
    if (remain <= 0) continue;
    const key = debtCustomerKey(s.customerId, s.customerName);
    if (!key) continue;
    const cur = salesRemainByKey.get(key) || {
      customerId: s.customerId,
      customerName: s.customerName || 'ลูกค้า',
      zone: s.zone || 'ทั่วไป',
      total: 0,
    };
    cur.total += remain;
    salesRemainByKey.set(key, cur);
  }

  for (const [key, agg] of salesRemainByKey) {
    if (map.has(key)) continue;
    map.set(key, {
      key,
      customerId: agg.customerId,
      customerName: agg.customerName,
      zone: agg.zone,
      totalDebt: agg.total,
    });
  }

  return [...map.values()].sort((a, b) => (b.totalDebt || 0) - (a.totalDebt || 0));
}

export function sumDebtCustomerRows(rows = []) {
  return rows.reduce((s, r) => s + (parseFloat(r.totalDebt) || 0), 0);
}
