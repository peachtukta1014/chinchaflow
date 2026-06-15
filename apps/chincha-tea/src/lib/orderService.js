import { fsPost } from './firestoreRest';
import { ensureStaffPresentOnSale } from './staffAttendanceService';
import { staffSnapshot, writeHistoryLog } from './historyLogService';
import { deductTeaOrderInventory } from './inventoryService';

export async function saveTeaOrder({
  dateKey,
  cart,
  cartTotal,
  payType,
  member,
  lang,
}) {
  if (!cart?.length) return;
  const created = await fsPost('teaOrders', {
    dateKey,
    items: cart,
    total: cartTotal,
    payType,
    createdBy: member?.name || 'ชินชา',
    createdByUid: member?.uid,
    branchId: member?.branchId || 'main',
    ...staffSnapshot(member),
    lang,
    createdAt: new Date().toISOString(),
  });
  await writeHistoryLog({
    action: 'teaOrder.create',
    collection: 'teaOrders',
    docId: created?.id || '',
    refPath: created?.id ? `teaOrders/${created.id}` : '',
    dateKey,
    member,
    summary: { total: cartTotal, cups: cart.reduce((s, i) => s + (i.qty || 1), 0), payType },
  });
  try {
    await deductTeaOrderInventory(cart);
  } catch (e) {
    console.warn('deductTeaOrderInventory failed', e);
  }
  try {
    await ensureStaffPresentOnSale({ dateKey, member });
  } catch (e) {
    console.warn('ensureStaffPresentOnSale failed', e);
  }
}
