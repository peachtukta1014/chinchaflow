import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, isFirebaseReady } from '../firebase';
import { dateKeyBangkok } from '../lib/date';
import { fsPatch, fsPost, fsSetStockDoc } from '../lib/firestoreRest';
import { sortBatchesFifoOrder } from '../lib/stockBatchUtils';

function withTimeout(promise, ms = 10000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

/** ตัดคงเหลือทีละรายการในล็อต (วันเก่า → รายการเก่า) */
export async function deductFifoFromBatches(batches, { liveKg, deadKg }) {
  let liveLeft = liveKg;
  let deadLeft = deadKg;
  const patches = [];

  for (const b of sortBatchesFifoOrder(batches)) {
    if (liveLeft <= 0 && deadLeft <= 0) break;
    let remLive = parseFloat(b.remainingLiveKg ?? b.liveKg) || 0;
    let remDead = parseFloat(b.remainingDeadKg ?? b.deadKg) || 0;
    let newLive = remLive;
    let newDead = remDead;

    if (liveLeft > 0 && remLive > 0) {
      const take = Math.min(liveLeft, remLive);
      newLive = remLive - take;
      liveLeft -= take;
    }
    if (deadLeft > 0 && remDead > 0) {
      const take = Math.min(deadLeft, remDead);
      newDead = remDead - take;
      deadLeft -= take;
    }

    if (newLive !== remLive || newDead !== remDead) {
      patches.push({
        id: b.id,
        remainingLiveKg: normalizeStockValues(newLive, 0).live,
        remainingDeadKg: normalizeStockValues(0, newDead).dead,
      });
    }
  }

  if (liveLeft > 0.001 || deadLeft > 0.001) {
    throw new Error(
      `สต๊อกในล็อตไม่พอ (ขาดเป็น ${liveLeft.toFixed(2)} กก. / ตาย ${deadLeft.toFixed(2)} กก.)`,
    );
  }

  for (const p of patches) {
    await fsPatch(`stockBatches/${p.id}`, {
      remainingLiveKg: p.remainingLiveKg,
      remainingDeadKg: p.remainingDeadKg,
    });
  }

  return patches;
}

/** กุ้งตายในบ่อ — ย้ายจากเป็น→ตายในล็อตเดียวกัน (FIFO วันเก่าก่อน) */
export async function transferLiveToDeadInBatches(batches, transferKg) {
  let left = transferKg;
  const patches = [];

  for (const b of sortBatchesFifoOrder(batches)) {
    if (left <= 0) break;
    const remLive = parseFloat(b.remainingLiveKg ?? b.liveKg) || 0;
    const remDead = parseFloat(b.remainingDeadKg ?? b.deadKg) || 0;
    if (remLive <= 0) continue;
    const take = Math.min(left, remLive);
    patches.push({
      id: b.id,
      remainingLiveKg: normalizeStockValues(remLive - take, 0).live,
      remainingDeadKg: normalizeStockValues(0, remDead + take).dead,
    });
    left -= take;
  }

  if (left > 0.001) {
    throw new Error(`กุ้งเป็นในล็อตมีแค่ ${(transferKg - left).toFixed(2)} กก. (ต้องการ ${transferKg} กก.)`);
  }

  for (const p of patches) {
    await fsPatch(`stockBatches/${p.id}`, {
      remainingLiveKg: p.remainingLiveKg,
      remainingDeadKg: p.remainingDeadKg,
    });
  }
  return patches;
}

export async function transferPondDeath(stock, transferKg, updateMainStock, batches = []) {
  if (batches.length > 0) {
    const patches = await transferLiveToDeadInBatches(batches, transferKg);
    const patchById = Object.fromEntries(patches.map((p) => [p.id, p]));
    const summed = sumStockFromBatches(
      batches.map((b) => {
        const p = patchById[b.id];
        return p
          ? { ...b, remainingLiveKg: p.remainingLiveKg, remainingDeadKg: p.remainingDeadKg }
          : b;
      }),
    );
    return updateMainStock(summed.live, summed.dead);
  }
  return updateMainStock(
    Math.max(0, stock.live - transferKg),
    Math.max(0, stock.dead + transferKg),
  );
}

export async function deductStockForSale(stock, liveKg, deadKg, updateMainStock, batches = []) {
  if (batches.length > 0) {
    const patches = await deductFifoFromBatches(batches, { liveKg, deadKg });
    const patchById = Object.fromEntries(patches.map((p) => [p.id, p]));
    const summed = sumStockFromBatches(
      batches.map((b) => {
        const p = patchById[b.id];
        return p
          ? { ...b, remainingLiveKg: p.remainingLiveKg, remainingDeadKg: p.remainingDeadKg }
          : b;
      }),
    );
    return updateMainStock(summed.live, summed.dead);
  }
  return updateMainStock(
    Math.max(0, stock.live - liveKg),
    Math.max(0, stock.dead - deadKg),
  );
}

/** คืนสต๊อกเมื่อลบบิล — คืนเข้าล็อตล่าสุดก่อน แล้วซิงก์ยอดรวม */
export async function restoreStockForSale(stock, liveKg, deadKg, updateMainStock, batches = []) {
  const cfg = normalizeStockValues(stock?.live ?? 0, stock?.dead ?? 0);
  let nextLive = cfg.live + (parseFloat(liveKg) || 0);
  let nextDead = cfg.dead + (parseFloat(deadKg) || 0);

  if (batches.length > 0 && (liveKg > 0 || deadKg > 0)) {
    const newest = [...sortBatchesFifoOrder(batches)].reverse()[0];
    if (newest?.id) {
      const remLive = parseFloat(newest.remainingLiveKg ?? newest.liveKg) || 0;
      const remDead = parseFloat(newest.remainingDeadKg ?? newest.deadKg) || 0;
      const patched = normalizeStockValues(remLive + liveKg, remDead + deadKg);
      await fsPatch(`stockBatches/${newest.id}`, {
        remainingLiveKg: patched.live,
        remainingDeadKg: patched.dead,
      });
      const summed = sumStockFromBatches(
        batches.map((b) => (b.id === newest.id
          ? { ...b, remainingLiveKg: patched.live, remainingDeadKg: patched.dead }
          : b)),
      );
      nextLive = Math.max(nextLive, summed.live);
      nextDead = Math.max(nextDead, summed.dead);
    }
  }

  return updateMainStock(
    normalizeStockValues(nextLive, nextDead).live,
    normalizeStockValues(nextLive, nextDead).dead,
  );
}

export function normalizeStockValues(live, dead) {
  return {
    live: Math.max(0, parseFloat(Number(live).toFixed(3))),
    dead: Math.max(0, parseFloat(Number(dead).toFixed(3))),
  };
}

/** รวมคงเหลือจากล็อต FIFO */
export function sumStockFromBatches(batches = []) {
  return batches.reduce(
    (acc, b) => ({
      live: acc.live + (parseFloat(b.remainingLiveKg ?? b.liveKg) || 0),
      dead: acc.dead + (parseFloat(b.remainingDeadKg ?? b.deadKg) || 0),
    }),
    { live: 0, dead: 0 },
  );
}

/**
 * ยอดขายได้จริง — ถ้ามีล็อตรับเข้าใช้ผลรวมคงเหลือตามวัน/รายการ
 * ไม่มีล็อตค่อยใช้ config/stock
 */
export function getEffectiveStock(configStock, batches = []) {
  const cfg = normalizeStockValues(configStock?.live ?? 0, configStock?.dead ?? 0);
  if (batches.length > 0) {
    const bat = sumStockFromBatches(batches);
    return normalizeStockValues(
      Math.max(cfg.live, bat.live),
      Math.max(cfg.dead, bat.dead),
    );
  }
  return cfg;
}

/** ซิงก์ config/stock ให้ตรงผลรวมล็อต (กรณีรับเข้าแล้วแต่ config ยังเป็น 0) */
export async function syncMainStockFromBatches(configStock, batches = []) {
  if (!batches.length) return null;
  const eff = sumStockFromBatches(batches);
  const cfg = normalizeStockValues(configStock?.live ?? 0, configStock?.dead ?? 0);
  const needsSync =
    eff.live > cfg.live + 0.001
    || eff.dead > cfg.dead + 0.001
    || ((cfg.live < 0.001 && cfg.dead < 0.001) && (eff.live > 0 || eff.dead > 0));
  if (!needsSync) return null;
  const val = normalizeStockValues(eff.live, eff.dead);
  await persistStock(val);
  return val;
}

/** บันทึก config/stock (REST + SDK fallback) */
export async function persistStock(val) {
  const payload = { ...val, updatedAt: new Date().toISOString() };
  let lastErr;
  try {
    if (isFirebaseReady) {
      await fsSetStockDoc(payload);
      return;
    }
  } catch (e) {
    lastErr = e;
    console.warn('fsSetStockDoc', e);
  }
  if (db) {
    try {
      await setDoc(doc(db, 'config', 'stock'), { ...val, updatedAt: serverTimestamp() }, { merge: true });
      return;
    } catch (e) {
      lastErr = e;
      console.error('persistStock SDK', e);
    }
  }
  throw lastErr || new Error('บันทึกสต๊อกไม่สำเร็จ');
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
  if (!isFirebaseReady) {
    throw new Error('Firebase config ไม่ครบ — บันทึกล็อต FIFO ไม่ได้');
  }
  const receiveDateKey = dateKeyBangkok();
  await withTimeout(fsPost('stockBatches', {
    receiveDateKey,
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
