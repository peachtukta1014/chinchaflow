import { cachedFetch, invalidateCache } from './fetchCache';
import { fsQueryRestocksByDate } from './firestoreRest';
import { isRestockOpen } from './restockService.js';

const pendingCacheKey = (dateKey) => `restock:pending:${dateKey}`;
const PENDING_TTL_MS = 60 * 1000;

/** ใบสั่งของวันนี้ที่ยังอยู่สถานะ pending / picked / pending_confirm */
export async function fetchPendingRestockCount(dateKey, { force = false } = {}) {
  const key = pendingCacheKey(dateKey);
  if (force) invalidateCache(key);
  const rows = await cachedFetch(key, () => fsQueryRestocksByDate(dateKey), PENDING_TTL_MS);
  return rows.filter((r) => isRestockOpen(r)).length;
}

export function invalidatePendingRestockCache(dateKey) {
  invalidateCache(pendingCacheKey(dateKey));
}
