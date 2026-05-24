import { fsPost } from './firestoreRest';

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
}
