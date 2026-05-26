import { fsListCollection } from '../lib/firestoreRest';
import { normalizeLineUserId, isValidLineUserId } from '../lib/lineUserId';
import { exactCustomerNameMatch } from '../lib/customerNameMatch';

function orderTime(o) {
  return String(o.createdAt || o.deliveryDate || '');
}

/**
 * รวมลูกค้าที่ทัก/สั่งผ่าน LINE OA จาก collection lineOrders (ตาม LINE UID)
 * @returns {Promise<Array<{ lineUserId: string, displayNames: string[], lastOrderAt: string, orderCount: number, lastDeliveryDate?: string }>>}
 */
export async function fetchLineOaContacts() {
  const orders = await fsListCollection('lineOrders', 300);
  const byUid = new Map();

  for (const o of orders) {
    const uid = normalizeLineUserId(o.lineUserId);
    if (!isValidLineUserId(uid)) continue;

    let row = byUid.get(uid);
    if (!row) {
      row = {
        lineUserId: uid,
        displayNames: new Set(),
        orderCount: 0,
        lastOrderAt: '',
        lastDeliveryDate: '',
      };
      byUid.set(uid, row);
    }

    row.orderCount += 1;
    const t = orderTime(o);
    if (t > row.lastOrderAt) {
      row.lastOrderAt = t;
      row.lastDeliveryDate = o.deliveryDate || '';
    }

    const names = new Set();
    if (o.customerName) names.add(String(o.customerName).trim());
    for (const it of o.items || []) {
      if (it.customerName) names.add(String(it.customerName).trim());
    }
    names.forEach((n) => { if (n) row.displayNames.add(n); });
  }

  return [...byUid.values()]
    .map((r) => ({
      lineUserId: r.lineUserId,
      displayNames: [...r.displayNames],
      orderCount: r.orderCount,
      lastOrderAt: r.lastOrderAt,
      lastDeliveryDate: r.lastDeliveryDate,
      suggestedName: [...r.displayNames][0] || 'ลูกค้า LINE',
    }))
    .sort((a, b) => b.lastOrderAt.localeCompare(a.lastOrderAt));
}

/** หาลูกค้าในรายชื่อหลักที่ผูก LINE UID นี้แล้ว */
export function findCustomerByLineUserId(allCustomers, lineUserId) {
  const uid = normalizeLineUserId(lineUserId);
  if (!uid) return null;
  return allCustomers.find((c) => normalizeLineUserId(c.lineUserId) === uid) || null;
}

/** หาลูกค้าที่ชื่อตรงเป๊ะกับชื่อในออเดอร์ LINE */
export function findCustomerByExactName(allCustomers, name) {
  const n = (name || '').trim();
  if (!n) return null;
  return allCustomers.find((c) => exactCustomerNameMatch(c.name, n)) || null;
}
