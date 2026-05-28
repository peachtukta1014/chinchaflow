import { fsQueryRestocksByDate } from './firestoreRest';

/** ใบสั่งของวันนี้ที่ยังไม่กด「ซื้อแล้ว」 */
export async function fetchPendingRestockCount(dateKey) {
  const rows = await fsQueryRestocksByDate(dateKey);
  return rows.filter((r) => r.purchaseStatus !== 'purchased').length;
}
