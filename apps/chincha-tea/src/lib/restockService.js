import { fsDelete, fsPatch } from './firestoreRest';
import { receiveRestockInventory } from './inventoryService';
import { actorSnapshot } from './teaUserService.js';

export const RESTOCK_STATUSES = ['pending', 'picked', 'pending_confirm', 'received', 'cancelled'];
const LEGACY_RECEIVED_STATUSES = ['received', 'purchased'];

export function normalizeRestockStatus(status) {
  if (status === 'purchased') return 'received';
  return RESTOCK_STATUSES.includes(status) ? status : 'pending';
}

export function isRestockReceived(req) {
  return LEGACY_RECEIVED_STATUSES.includes(req?.purchaseStatus) && Number(req?.purchaseTotal) > 0;
}

export function isRestockPurchased(req) {
  return isRestockReceived(req);
}

export function isRestockOpen(req) {
  return ['pending', 'picked', 'pending_confirm'].includes(normalizeRestockStatus(req?.purchaseStatus));
}

export function restockPurchaseTotal(req) {
  return isRestockReceived(req) ? Math.round(Number(req.purchaseTotal)) : 0;
}

/** รวมยอดซื้อของที่รับเข้า stock แล้วในวัน */
export function sumPurchasedRestocks(restocks) {
  return (restocks || []).reduce((s, r) => s + restockPurchaseTotal(r), 0);
}

/** พนักงานลบรายการที่ตัวเองส่งได้ · แอดมินลบได้ทุกรายการ */
export function canManageRestock(req, member) {
  if (!member?.uid) return false;
  if (member.role === 'admin') return true;
  return Boolean(req?.uid && req.uid === member.uid && !isRestockReceived(req));
}

/** เฉพาะแอดมินเท่านั้น — บันทึก/แก้ราคาทุนซื้อเข้า */
export function canMarkRestockPurchased(req, member) {
  return Boolean(req?.id && member?.role === 'admin' && !isRestockReceived(req));
}

export async function deleteRestockRequest(id) {
  await fsDelete(`restocks/${id}`);
}

/** ลบบรรทัดเดียวในรายการสั่งของ — ถ้าไม่เหลือรายการจะลบเอกสารทั้งใบ */
export async function removeRestockLine(req, lineIndex) {
  if (isRestockReceived(req)) throw new Error('received restock is locked');
  const items = [...(req.items || [])];
  items.splice(lineIndex, 1);
  if (items.length === 0) {
    await fsDelete(`restocks/${req.id}`);
    return null;
  }
  await fsPatch(`restocks/${req.id}`, { items });
  return { ...req, items };
}

export async function updateRestockStatus(id, { status, member, note = '' } = {}) {
  const nextStatus = normalizeRestockStatus(status);
  if (nextStatus === 'received') throw new Error('use markRestockReceived for stock receiving');
  const now = new Date().toISOString();
  const actor = actorSnapshot(member);
  const patch = {
    purchaseStatus: nextStatus,
    statusUpdatedAt: now,
    statusUpdatedByUid: actor.uid,
    statusUpdatedBy: actor.name,
    statusUpdatedActor: actor,
    actor,
  };
  if (note) patch.statusNote = note;
  await fsPatch(`restocks/${id}`, patch);
  return patch;
}

export async function markRestockReceived(id, { purchaseTotal, purchaseItems, purchasedBy, purchasedByUid, member }) {
  const amount = Math.round(Number(purchaseTotal));
  if (!amount || amount <= 0) throw new Error('invalid amount');
  const now = new Date().toISOString();
  const actor = actorSnapshot(member || { uid: purchasedByUid, name: purchasedBy, role: 'admin' });
  const cleanItems = Array.isArray(purchaseItems)
    ? purchaseItems.map((item) => ({
      name: item.name,
      qty: Math.max(1, Number(item.qty) || 1),
      status: item.status || 'out',
      unitPrice: Math.max(0, Math.round(Number(item.unitPrice) || 0)),
      lineTotal: Math.max(0, Math.round(Number(item.lineTotal) || 0)),
      unit: (item.unit || 'ชิ้น').trim(),
      base_unit: (item.base_unit || item.baseUnit || item.unit || 'ชิ้น').trim(),
      conversion_rate: Math.max(1, Math.round(Number(item.conversion_rate ?? item.conversionRate) || 1)),
    }))
    : undefined;
  const inventoryUpdates = await receiveRestockInventory(cleanItems || []);
  const patch = {
    purchaseStatus: 'received',
    purchaseTotal: amount,
    purchaseItems: cleanItems,
    purchasedAt: now,
    receivedAt: now,
    purchasedBy: purchasedBy || actor.name || '—',
    purchasedByUid: purchasedByUid || actor.uid || '',
    receivedBy: actor.name,
    receivedByUid: actor.uid,
    actor,
    inventoryReceived: inventoryUpdates.map((item) => ({
      name: item.name,
      unit: item.unit,
      base_unit: item.base_unit,
      conversion_rate: item.conversion_rate,
      stock_base_qty: item.stock_base_qty,
      latestReceivedBaseQty: item.latestReceivedBaseQty,
    })),
  };
  await fsPatch(`restocks/${id}`, patch);
  return patch;
}

export async function markRestockPurchased(id, payload) {
  return markRestockReceived(id, payload);
}

export async function confirmPurchase(id, payload) {
  return markRestockReceived(id, payload);
}
