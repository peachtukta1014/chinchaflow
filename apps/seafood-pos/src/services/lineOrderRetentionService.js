import { fsDelete, fsListCollection } from '../lib/firestoreRest';
import {
  LINE_ORDER_RETENTION_KEEP,
  selectLineOrdersToPrune,
} from '../lib/lineOrderRetention';

/** โหลด lineOrders ทั้งหมดที่ list ได้ (สูงสุด ~5,000 รายการ) */
export async function fetchAllLineOrdersForRetention() {
  return fsListCollection('lineOrders', 500);
}

export async function previewLineOrderPrune(keepCount = LINE_ORDER_RETENTION_KEEP) {
  const orders = await fetchAllLineOrdersForRetention();
  return selectLineOrdersToPrune(orders, keepCount);
}

export async function pruneOldLineOrders({
  keepCount = LINE_ORDER_RETENTION_KEEP,
  dryRun = false,
} = {}) {
  const summary = await previewLineOrderPrune(keepCount);
  let deleted = 0;
  let errors = 0;

  if (!dryRun) {
    for (const order of summary.deleteCandidates) {
      try {
        await fsDelete(`lineOrders/${order.id}`);
        deleted += 1;
      } catch (e) {
        console.warn('prune lineOrders delete failed', order.id, e);
        errors += 1;
      }
    }
  }

  return { ...summary, deleted, errors, dryRun };
}
