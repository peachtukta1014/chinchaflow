/**
 * กฎแสดงออเดอร์รอส่งบนบอร์ด LINE (แยกจาก Firestore query เพื่อทดสอบ logic ได้)
 */

/** ไม่ซ่อนออเดอร์ค้างส่งที่เลยวันส่งแล้ว — เดิม 7 วันทำให้หายจากบอร์ด */
export const LINE_ORDER_BOARD_FUTURE_DAYS = 14;

/**
 * @param {Array} rows
 * @param {{ maxDate?: string }} opts — maxDate = วันส่งล่วงหน้าสูงสุด (YYYY-MM-DD)
 */
export function filterPendingLineOrdersForBoard(rows, { maxDate } = {}) {
  return (rows || []).filter((o) => {
    if (o.status === 'cancelled' || o.status === 'done') return false;
    if (o.status !== 'pending') return false;
    const dk = String(o.deliveryDate || '');
    if (!dk || !/^\d{4}-\d{2}-\d{2}$/.test(dk)) return true;
    if (maxDate && dk > maxDate) return false;
    return true;
  });
}

export function sortLineOrdersForBoard(a, b) {
  const da = a.deliveryDate || '';
  const db = b.deliveryDate || '';
  if (da !== db) return da.localeCompare(db);
  const ta = a.createdAt || '';
  const tb = b.createdAt || '';
  return String(tb).localeCompare(String(ta));
}
