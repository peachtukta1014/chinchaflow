import { fsPost } from './firestoreRest';
import { ensurePrimaryStaffPresentOnSale } from './staffAttendanceService';

export async function saveTeaOrder({
  dateKey,
  cart,
  cartTotal,
  payType,
  member,
  lang,
}) {
  if (!cart?.length) return;
  await fsPost('teaOrders', {
    dateKey,
    items: cart,
    total: cartTotal,
    payType,
    createdBy: member?.name || 'ชินชา',
    createdByUid: member?.uid,
    lang,
    createdAt: new Date().toISOString(),
  });
  try {
    await ensurePrimaryStaffPresentOnSale({ dateKey, member });
  } catch (e) {
    console.warn('ensurePrimaryStaffPresentOnSale failed', e);
  }
}
