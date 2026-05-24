import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, isFirebaseReady } from '../firebase';
import { fsPost, fsSetStockDoc } from '../lib/firestoreRest';

function withTimeout(promise, ms = 10000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

export async function deductStockForSale(stock, liveKg, deadKg, updateMainStock) {
  return updateMainStock(
    Math.max(0, stock.live - liveKg),
    Math.max(0, stock.dead - deadKg),
  );
}

export function normalizeStockValues(live, dead) {
  return {
    live: Math.max(0, parseFloat(Number(live).toFixed(3))),
    dead: Math.max(0, parseFloat(Number(dead).toFixed(3))),
  };
}

/** บันทึก config/stock (REST + SDK fallback) */
export async function persistStock(val) {
  const payload = { ...val, updatedAt: new Date().toISOString() };
  try {
    if (isFirebaseReady) await fsSetStockDoc(payload);
  } catch (e) {
    console.warn('fsSetStockDoc', e);
    if (db) {
      setDoc(doc(db, 'config', 'stock'), { ...val, updatedAt: serverTimestamp() }, { merge: true }).catch(console.error);
    }
  }
}

/** รับกุ้งเข้า — บันทึกล็อต FIFO (เรียกหลังอัปเดตสต๊อกแล้ว) */
export async function createStockBatchRecord({
  liveKg,
  deadKg,
  costPerKg,
  transport,
  note,
}) {
  const shrimpCost = (liveKg + deadKg) * costPerKg;
  const grandTotal = shrimpCost + transport;
  const effectiveCost = (liveKg + deadKg) > 0 ? grandTotal / (liveKg + deadKg) : 0;
  if (!isFirebaseReady) return { grandTotal, effectiveCost };
  await withTimeout(fsPost('stockBatches', {
    purchaseDate: new Date().toISOString(),
    liveKg,
    deadKg,
    costPerKg,
    transport,
    totalCost: grandTotal,
    effectiveCostPerKg: effectiveCost,
    remainingLiveKg: liveKg,
    remainingDeadKg: deadKg,
    note,
  }));
  return { grandTotal, effectiveCost };
}
