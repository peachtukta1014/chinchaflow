import { fsAddDoc, fsListCollection, fsPatch } from '../lib/firestoreRest';
import { billAmount } from '../lib/salesAggregate';

export async function requestSaleDelete(sale, member, reason = '') {
  if (!sale?.id || !member?.uid) throw new Error('ข้อมูลบิลไม่ครบ');
  const billNo = sale.billNo || sale.id;
  const amount = billAmount(sale);
  await fsAddDoc('shrimpAdminAlerts', {
    type: 'sale_delete_request',
    status: 'pending',
    saleId: sale.id,
    billNo,
    customerName: sale.customerName || '',
    amount,
    reason: String(reason || '').trim(),
    requestedAt: new Date().toISOString(),
    requestedByUid: member.uid,
    requestedByName: member.name || member.email || 'แมนเนเจอร์',
  });
}

export async function fetchPendingAdminAlerts(limit = 20) {
  const rows = await fsListCollection('shrimpAdminAlerts', limit);
  return rows
    .filter((r) => r.status === 'pending')
    .sort((a, b) => String(b.requestedAt || '').localeCompare(String(a.requestedAt || '')));
}

export async function resolveAdminAlert(alertId, member, status = 'resolved') {
  if (!alertId) return;
  await fsPatch(`shrimpAdminAlerts/${alertId}`, {
    status,
    resolvedAt: new Date().toISOString(),
    resolvedByUid: member?.uid || '',
    resolvedByName: member?.name || member?.email || 'แอดมิน',
  });
}
