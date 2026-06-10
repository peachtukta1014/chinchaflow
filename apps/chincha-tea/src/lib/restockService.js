import { fsDelete, fsPatch } from './firestoreRest';

export function isRestockPurchased(req) {
  return req?.purchaseStatus === 'purchased' && Number(req?.purchaseTotal) > 0;
}

export function restockPurchaseTotal(req) {
  return isRestockPurchased(req) ? Math.round(Number(req.purchaseTotal)) : 0;
}

/** รวมยอดซื้อของที่บันทึก "ซื้อแล้ว" ในวัน */
export function sumPurchasedRestocks(restocks) {
  return (restocks || []).reduce((s, r) => s + restockPurchaseTotal(r), 0);
}

/** พนักงานลบรายการที่ตัวเองส่งได้ · แอดมินลบได้ทุกรายการ */
export function canManageRestock(req, member) {
  if (!member?.uid) return false;
  if (member.role === 'admin') return true;
  return Boolean(req?.uid && req.uid === member.uid);
}

/** แอดมินหรือเจ้าของรายการ — บันทึกยอดซื้อจริง */
export function canMarkRestockPurchased(req, member) {
  return canManageRestock(req, member);
}

export async function deleteRestockRequest(id) {
  await fsDelete(`restocks/${id}`);
}

/** ลบบรรทัดเดียวในรายการสั่งของ — ถ้าไม่เหลือรายการจะลบเอกสารทั้งใบ */
export async function removeRestockLine(req, lineIndex) {
  const items = [...(req.items || [])];
  items.splice(lineIndex, 1);
  if (items.length === 0) {
    await fsDelete(`restocks/${req.id}`);
    return null;
  }
  await fsPatch(`restocks/${req.id}`, { items });
  return { ...req, items };
}

export async function markRestockPurchased(id, { purchaseTotal, purchaseItems, purchasedBy }) {
  const amount = Math.round(Number(purchaseTotal));
  if (!amount || amount <= 0) throw new Error('invalid amount');
  const now = new Date().toISOString();
  const cleanItems = Array.isArray(purchaseItems)
    ? purchaseItems.map((item) => ({
      name: item.name,
      qty: Math.max(1, Number(item.qty) || 1),
      status: item.status || 'out',
      unitPrice: Math.max(0, Math.round(Number(item.unitPrice) || 0)),
      lineTotal: Math.max(0, Math.round(Number(item.lineTotal) || 0)),
    }))
    : undefined;
  const patch = {
    purchaseStatus: 'purchased',
    purchaseTotal: amount,
    purchaseItems: cleanItems,
    purchasedAt: now,
    purchasedBy: purchasedBy || '—',
  };
  await fsPatch(`restocks/${id}`, patch);
  return patch;
}
