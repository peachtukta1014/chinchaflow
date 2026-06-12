import { cachedFetch, invalidateCache } from './fetchCache';
import { fsQueryRestocksByDate } from './firestoreRest';

const pendingCacheKey = (dateKey) => `restock:pending:${dateKey}`;
const PENDING_TTL_MS = 60 * 1000;

/** ใบสั่งของวันนี้ที่ยังไม่กด「ซื้อแล้ว」 */
export async function fetchPendingRestockCount(dateKey, { force = false } = {}) {
  const key = pendingCacheKey(dateKey);
  if (force) invalidateCache(key);
  const rows = await cachedFetch(key, () => fsQueryRestocksByDate(dateKey), PENDING_TTL_MS);
  return rows.filter((r) => !['received', 'purchased', 'cancelled'].includes(r.purchaseStatus)).length;
}

export function invalidatePendingRestockCache(dateKey) {
  invalidateCache(pendingCacheKey(dateKey));
}
