/**
 * Offline POS bill queue — บันทึกบิลลง IndexedDB ตอนไม่มีเน็ต แล้ว sync เมื่อกลับมา
 */
import { isNetworkError, isNetworkOnline } from './networkStatus.js';
import { idbDelete, idbGetAll, idbPut } from './offlineDb.js';
import {
  countActionablePending,
  OFFLINE_QUEUE_STATUSES,
  sumPendingStockKg,
} from './offlineQueueUtils.js';
import {
  buildBillData,
  saveBillWithCart,
  validateStockForSale,
} from '../services/salesService.js';
import { scheduleShrimpBillPreRender } from './shrimpBillApi.js';

export { countActionablePending, OFFLINE_QUEUE_STATUSES, sumPendingStockKg } from './offlineQueueUtils.js';

function newQueueId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `q-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function sortByCreatedAt(records) {
  return [...records].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

export async function listPendingSales() {
  const rows = await idbGetAll();
  return sortByCreatedAt(rows);
}

export async function refreshPendingSummary() {
  const rows = await listPendingSales();
  return {
    records: rows,
    pendingCount: countActionablePending(rows),
    pendingStock: sumPendingStockKg(rows.filter((r) => r.status !== OFFLINE_QUEUE_STATUSES.syncing)),
  };
}

/**
 * ใส่บิลในคิว offline — ตรวจสต๊อกรวมคิวที่ค้างอยู่แล้ว
 * @returns {{ ok: true, queued: true, billData, total, remain, queueId } | { ok: false, message }}
 */
export async function enqueueOfflineSale({
  cartItems,
  stock,
  stockBatches = [],
  customer,
  selectedCustomer,
  paymentType,
  paidAmount,
  billNo,
  recordedBy,
  photoUrl = null,
  pendingStockDeduction = { live: 0, dead: 0 },
}) {
  const stockCheck = validateStockForSale(
    cartItems,
    stock,
    stockBatches,
    pendingStockDeduction,
  );
  if (!stockCheck.ok) return { ok: false, message: stockCheck.message };

  const { billData, total, remain, dateKey } = buildBillData({
    cartItems,
    customer,
    selectedCustomer,
    paymentType,
    paidAmount,
    billNo,
    recordedBy,
    photoUrl,
  });

  const id = newQueueId();
  const record = {
    id,
    createdAt: new Date().toISOString(),
    status: OFFLINE_QUEUE_STATUSES.pending,
    attemptCount: 0,
    lastError: null,
    payload: {
      cartItems,
      customer: {
        id: customer?.id || selectedCustomer,
        name: customer?.name || '',
        zone: customer?.zone || 'ทั่วไป',
        lineUserId: customer?.lineUserId || null,
      },
      selectedCustomer,
      paymentType,
      paidAmount,
      billNo,
      recordedBy,
      photoUrl,
      billData,
      dateKey,
      liveKg: stockCheck.liveKg,
      deadKg: stockCheck.deadKg,
      queuedAt: new Date().toISOString(),
    },
  };

  await idbPut(record);
  return {
    ok: true,
    queued: true,
    billData,
    total,
    remain,
    queueId: id,
    liveKg: stockCheck.liveKg,
    deadKg: stockCheck.deadKg,
  };
}

/**
 * บันทึกบิล — online ส่งตรง Firebase; offline / network error → คิว IndexedDB
 */
export async function saveBillWithCartOrQueue(params) {
  const {
    pendingStockDeduction = { live: 0, dead: 0 },
    preferQueue = false,
    ...saveParams
  } = params;

  const shouldQueueNow = preferQueue || !isNetworkOnline();

  if (shouldQueueNow) {
    return enqueueOfflineSale({ ...saveParams, pendingStockDeduction });
  }

  try {
    const result = await saveBillWithCart({
      ...saveParams,
      pendingStockDeduction,
    });
    return result;
  } catch (err) {
    if (isNetworkError(err)) {
      return enqueueOfflineSale({ ...saveParams, pendingStockDeduction });
    }
    throw err;
  }
}

/**
 * Sync คิว offline ตามลำดับเวลา — ใช้สต๊อก/server ล่าสุดตอน sync
 * @returns {{ synced: number, failed: number, errors: string[] }}
 */
export async function syncPendingSales({
  loadStockContext,
  updateMainStock,
  onItemSynced,
} = {}) {
  if (!isNetworkOnline()) {
    return { synced: 0, failed: 0, errors: [], skipped: true };
  }

  const rows = await listPendingSales();
  const actionable = rows.filter(
    (r) => r.status === OFFLINE_QUEUE_STATUSES.pending
      || r.status === OFFLINE_QUEUE_STATUSES.failed,
  );

  let synced = 0;
  let failed = 0;
  const errors = [];

  for (const row of actionable) {
    const syncing = { ...row, status: OFFLINE_QUEUE_STATUSES.syncing };
    await idbPut(syncing);

    try {
      const ctx = await loadStockContext();
      const p = row.payload;
      const customer = {
        id: p.customer?.id || p.selectedCustomer,
        name: p.customer?.name || p.billData?.customerName || '',
        zone: p.customer?.zone || p.billData?.zone || 'ทั่วไป',
        lineUserId: p.customer?.lineUserId || p.billData?.customerLineUserId || null,
      };

      const result = await saveBillWithCart({
        cartItems: p.cartItems,
        stock: ctx.stock,
        stockBatches: ctx.stockBatches,
        customer,
        selectedCustomer: p.selectedCustomer,
        paymentType: p.paymentType,
        paidAmount: p.paidAmount,
        billNo: p.billNo,
        recordedBy: p.recordedBy,
        photoUrl: p.photoUrl,
        updateMainStock,
        queuedBillData: p.billData,
        queuedDateKey: p.dateKey,
        skipPendingDeduction: true,
      });

      if (!result.ok) {
        throw new Error(result.message || 'บันทึกบิลไม่สำเร็จ');
      }

      await idbDelete(row.id);
      synced += 1;
      onItemSynced?.(result.billData);
      if (result.saleId) {
        scheduleShrimpBillPreRender({ ...result.billData, id: result.saleId }, customer);
      }
    } catch (err) {
      failed += 1;
      const msg = String(err?.message || err || 'sync failed');
      errors.push(msg);
      await idbPut({
        ...row,
        status: OFFLINE_QUEUE_STATUSES.failed,
        attemptCount: (row.attemptCount || 0) + 1,
        lastError: msg,
        lastAttemptAt: new Date().toISOString(),
      });
    }
  }

  return { synced, failed, errors, skipped: false };
}
