import { sumCartStockKg } from './cartStock.js';

export const OFFLINE_QUEUE_STATUSES = {
  pending: 'pending',
  syncing: 'syncing',
  failed: 'failed',
};

/** รวม kg ที่คิว offline จองไว้แล้ว (pending + failed; ไม่นับ syncing) */
export function sumPendingStockKg(records = []) {
  let live = 0;
  let dead = 0;
  for (const row of records) {
    if (row.status === OFFLINE_QUEUE_STATUSES.syncing) continue;
    const payload = row.payload || {};
    if (payload.liveKg != null && payload.deadKg != null) {
      live += parseFloat(payload.liveKg) || 0;
      dead += parseFloat(payload.deadKg) || 0;
      continue;
    }
    const fromCart = sumCartStockKg(payload.cartItems || []);
    live += fromCart.liveKg;
    dead += fromCart.deadKg;
  }
  return { live, dead };
}

export function countActionablePending(records = []) {
  return records.filter((r) => r.status === OFFLINE_QUEUE_STATUSES.pending
    || r.status === OFFLINE_QUEUE_STATUSES.failed).length;
}

/** Pure stock check with offline queue reservation (mirrors salesService.validateStockForSale). */
export function sellableStockAfterReservation(avail, pendingDeduction = { live: 0, dead: 0 }) {
  const reservedLive = Math.max(0, parseFloat(pendingDeduction.live) || 0);
  const reservedDead = Math.max(0, parseFloat(pendingDeduction.dead) || 0);
  return {
    live: Math.max(0, (parseFloat(avail.live) || 0) - reservedLive),
    dead: Math.max(0, (parseFloat(avail.dead) || 0) - reservedDead),
  };
}
