import { debtCustomerKey } from '../lib/debtCustomerKey';
import { fsIncrementDebt, fsPatch, fsPost, fsObj, FS_BASE, fsAuthHeaders } from '../lib/firestoreRest';

/** เพิ่ม/ลดยอดลูกหนี้ (REST wrapper) */
export async function incrementCustomerDebt(customerId, meta, delta) {
  const key = debtCustomerKey(customerId, meta.customerName);
  if (!key) return;
  return fsIncrementDebt(key, { ...meta, customerId: key }, delta);
}

async function upsertDebtDoc(customerId, meta, totalDebt) {
  if (!FS_BASE) return;
  const path = `customerDebts/${customerId}`;
  const headers = await fsAuthHeaders();
  const fields = fsObj({
    customerId,
    customerName: meta.customerName || '',
    zone: meta.zone || 'ทั่วไป',
    lastBillNo: meta.lastBillNo || '',
    lastUpdated: new Date().toISOString(),
    totalDebt,
  });
  const r = await fetch(`${FS_BASE}/${path}`, { headers });
  if (r.ok) {
    await fsPatch(path, {
      customerName: meta.customerName,
      zone: meta.zone,
      lastBillNo: meta.lastBillNo,
      lastUpdated: new Date().toISOString(),
      totalDebt,
    });
    return;
  }
  if (r.status === 404) {
    await fetch(
      `${FS_BASE}/customerDebts?documentId=${encodeURIComponent(customerId)}`,
      { method: 'POST', headers, body: JSON.stringify({ fields }) },
    );
    return;
  }
  throw new Error(`ลูกหนี้ HTTP ${r.status}`);
}

/** รวมยอดค้างจากบิล sales แล้วอัปเดต customerDebts (แก้บิลค้างที่ยังไม่ขึ้นลูกหนี้) */
export async function reconcileDebtsFromSales(sales = []) {
  const byKey = new Map();
  for (const s of sales) {
    const remain = parseFloat(s.remainingAmount) || 0;
    if (remain <= 0) continue;
    const key = debtCustomerKey(s.customerId, s.customerName);
    if (!key) continue;
    const prev = byKey.get(key) || {
      customerName: s.customerName || '',
      zone: s.zone || 'ทั่วไป',
      lastBillNo: s.billNo || '',
      total: 0,
    };
    prev.total += remain;
    if (s.billNo) prev.lastBillNo = s.billNo;
    byKey.set(key, prev);
  }
  await Promise.all(
    [...byKey.entries()].map(([key, v]) => upsertDebtDoc(key, {
      customerName: v.customerName,
      zone: v.zone,
      lastBillNo: v.lastBillNo,
    }, v.total)),
  );
}
