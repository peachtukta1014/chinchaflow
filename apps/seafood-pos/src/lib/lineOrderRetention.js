/** จำนวนออเดอร์ปิด (done/cancelled) ที่เก็บไว้ — เก่ากว่านี้ลบได้ถ้าปลอดภัย */
export const LINE_ORDER_RETENTION_KEEP = 300;

const CLOSED_STATUSES = new Set(['done', 'cancelled']);
const ACTIVE_STATUSES = new Set(['pending', 'delivering']);

export function closedAtOf(order) {
  if (!order) return '';
  if (order.status === 'done') return order.completedAt || order.createdAt || '';
  if (order.status === 'cancelled') return order.cancelledAt || order.createdAt || '';
  return order.createdAt || '';
}

/** ออเดอร์ที่ลบจาก Firestore ได้โดยไม่กระทบบิล/บอร์ด */
export function isLineOrderSafeToDelete(order) {
  if (!order?.id) return false;
  if (ACTIVE_STATUSES.has(order.status)) return false;
  if (order.status === 'cancelled') return true;
  if (order.status === 'done') return !!(order.salesId || order.billNo);
  return false;
}

function sortClosedDesc(a, b) {
  const ta = String(closedAtOf(a));
  const tb = String(closedAtOf(b));
  const cmp = tb.localeCompare(ta);
  if (cmp !== 0) return cmp;
  return String(b.id || '').localeCompare(String(a.id || ''));
}

/**
 * เลือกออเดอร์ปิดที่เกินโควต้าให้ลบ — ไม่แตะ pending/delivering
 * @returns {{ total, activeCount, closedCount, keepClosed, deleteCandidates, skippedUnsafe }}
 */
export function selectLineOrdersToPrune(orders, keepCount = LINE_ORDER_RETENTION_KEEP) {
  const list = Array.isArray(orders) ? orders : [];
  const activeCount = list.filter((o) => ACTIVE_STATUSES.has(o.status)).length;
  const closed = list.filter((o) => CLOSED_STATUSES.has(o.status));
  const sorted = [...closed].sort(sortClosedDesc);
  const keepClosed = Math.min(Math.max(0, keepCount), sorted.length);
  const overflow = sorted.slice(keepClosed);
  const deleteCandidates = overflow.filter(isLineOrderSafeToDelete);
  const skippedUnsafe = overflow.filter((o) => !isLineOrderSafeToDelete(o));

  return {
    total: list.length,
    activeCount,
    closedCount: closed.length,
    keepClosed,
    deleteCandidates,
    skippedUnsafe,
  };
}
