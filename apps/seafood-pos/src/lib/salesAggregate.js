/** รวมยอดขายจากบิล sales — รองรับทั้งรูปแบบ SDK และ REST */
export function normalizeBillItems(bill) {
  return (bill.items || []).map((i) => ({
    productId: i.productId,
    type: i.type || (i.productId === 'dead' ? 'dead' : 'live'),
    weightKg: parseFloat(i.weightKg ?? i.weight ?? 0) || 0,
    lineTotal: parseFloat(i.lineTotal ?? i.total ?? 0) || 0,
  }));
}

export function aggregateDailySales(bills) {
  const gradeKg = { large: 0, medium: 0, small: 0 };
  let liveKg = 0;
  let liveRevenue = 0;
  let deadKg = 0;
  let deadRevenue = 0;

  for (const bill of bills) {
    for (const item of normalizeBillItems(bill)) {
      if (item.type === 'dead') {
        deadKg += item.weightKg;
        deadRevenue += item.lineTotal;
      } else {
        liveKg += item.weightKg;
        liveRevenue += item.lineTotal;
        if (item.productId in gradeKg) gradeKg[item.productId] += item.weightKg;
      }
    }
  }

  return {
    billCount: bills.length,
    revenueTotal: bills.reduce((s, b) => s + (parseFloat(b.total) || 0), 0),
    liveKg,
    liveRevenue,
    deadKg,
    deadRevenue,
    gradeKg,
    gradeTotalKg: gradeKg.large + gradeKg.medium + gradeKg.small,
  };
}

export function mergeSalesDocs(cloud = [], local = []) {
  const map = new Map();
  for (const doc of cloud) {
    const key = doc.billNo || doc.id;
    if (key) map.set(key, doc);
  }
  for (const doc of local) {
    const key = doc.billNo || `local-${doc.timestamp}`;
    if (!map.has(key)) map.set(key, doc);
  }
  return [...map.values()];
}

export function billMatchesDateKey(bill, dateKey) {
  if (bill.dateKey === dateKey) return true;
  const created = typeof bill.createdAt === 'string' ? bill.createdAt : '';
  return created.startsWith(dateKey);
}
