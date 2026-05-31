import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, isFirebaseReady } from '../firebase';
import { dateKeyBangkok } from '../lib/date';
import { fsPatch, fsPost, fsSetStockDoc, fsAtomicStockBatchCommit } from '../lib/firestoreRest';
import { receiveDateKeyOf, sortBatchesFifoOrder } from '../lib/stockBatchUtils';

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

  await fsAtomicStockBatchCommit(patches);

  return patches;
}

/** กุ้งตายในบ่อ — ย้ายจากเป็น→ตายในล็อตเดียวกัน (FIFO วันเก่าก่อน) */
export async function transferLiveToDeadInBatches(batches, transferKg) {
  let left = transferKg;
  const patches = [];
  const allocations = [];

  for (const b of sortBatchesFifoOrder(batches)) {
    if (left <= 0) break;
    const remLive = parseFloat(b.remainingLiveKg ?? b.liveKg) || 0;
    const remDead = parseFloat(b.remainingDeadKg ?? b.deadKg) || 0;
    if (remLive <= 0) continue;
    const take = Math.min(left, remLive);
    const next = {
      remainingLiveKg: normalizeStockValues(remLive - take, 0).live,
      remainingDeadKg: normalizeStockValues(0, remDead + take).dead,
    };
    patches.push({ id: b.id, ...next });
    allocations.push({
      batchId: b.id,
      receiveDateKey: receiveDateKeyOf(b),
      batchNote: b.note || '',
      liveTaken: take,
      deadAdded: take,
    });
    left -= take;
  }

  if (left > 0.001) {
    throw new Error(`กุ้งเป็นในล็อตมีแค่ ${(transferKg - left).toFixed(2)} กก. (ต้องการ ${transferKg} กก.)`);
  }

  await fsAtomicStockBatchCommit(patches);
  return { patches, allocations };
}

/** เสียหาย/ตัดทิ้ง — หักเฉพาะกุ้งเป็น ไม่เพิ่มกุ้งตายขาย */
export async function deductSpoilageFromBatches(batches, lossKg) {
  let left = lossKg;
  const patches = [];
  const allocations = [];

  for (const b of sortBatchesFifoOrder(batches)) {
    if (left <= 0) break;
    const remLive = parseFloat(b.remainingLiveKg ?? b.liveKg) || 0;
    const remDead = parseFloat(b.remainingDeadKg ?? b.deadKg) || 0;
    if (remLive <= 0) continue;
    const take = Math.min(left, remLive);
    patches.push({
      id: b.id,
      remainingLiveKg: normalizeStockValues(remLive - take, 0).live,
      remainingDeadKg: remDead,
    });
    allocations.push({
      batchId: b.id,
      receiveDateKey: receiveDateKeyOf(b),
      batchNote: b.note || '',
      liveTaken: take,
      deadAdded: 0,
    });
    left -= take;
  }

  if (left > 0.001) {
    throw new Error(`กุ้งเป็นในล็อตมีแค่ ${(lossKg - left).toFixed(2)} กก. (ต้องการ ${lossKg} กก.)`);
  }

  await fsAtomicStockBatchCommit(patches);
  return { patches, allocations };
}

/** ต้นทุนเฉลี่ย/กก. จากล็อตคงเหลือ (ประมาณการของเสีย) */
export function estimateAvgCostPerKg(batches = []) {
  let totalKg = 0;
  let totalCost = 0;
  for (const b of batches) {
    const live = parseFloat(b.remainingLiveKg ?? b.liveKg) || 0;
    const dead = parseFloat(b.remainingDeadKg ?? b.deadKg) || 0;
    const kg = live + dead;
    if (kg <= 0) continue;
    const perKg = parseFloat(b.effectiveCostPerKg ?? b.costPerKg) || 0;
    totalKg += kg;
    totalCost += perKg * kg;
  }
  return totalKg > 0 ? totalCost / totalKg : 0;
}

/** หักเฉพาะกุ้งตายในล็อต (เสียหายไม่ขาย) */
async function deductDeadSpoilageFromBatches(batches, lossKg) {
  let left = lossKg;
  const patches = [];
  const allocations = [];

  for (const b of sortBatchesFifoOrder(batches)) {
    if (left <= 0) break;
    const remLive = parseFloat(b.remainingLiveKg ?? b.liveKg) || 0;
    const remDead = parseFloat(b.remainingDeadKg ?? b.deadKg) || 0;
    if (remDead <= 0) continue;
    const take = Math.min(left, remDead);
    patches.push({
      id: b.id,
      remainingLiveKg: remLive,
      remainingDeadKg: normalizeStockValues(0, remDead - take).dead,
    });
    allocations.push({
      batchId: b.id,
      receiveDateKey: receiveDateKeyOf(b),
      batchNote: b.note || '',
      liveTaken: 0,
      deadTaken: take,
      deadAdded: 0,
    });
    left -= take;
  }

  if (left > 0.001) {
    throw new Error(`กุ้งตายในล็อตมีแค่ ${(lossKg - left).toFixed(2)} กก. (ต้องการ ${lossKg} กก.)`);
  }

  await fsAtomicStockBatchCommit(patches);
  return { patches, allocations };
}

async function logStockAdjustment({
  type,
  weightKg = 0,
  note = '',
  recordedBy = '',
  allocations = [],
  extra = {},
}) {
  if (!isFirebaseReady) return;
  await fsPost('stockAdjustments', {
    type,
    dateKey: dateKeyBangkok(),
    weightKg: normalizeStockValues(weightKg, 0).live,
    note: String(note || '').trim(),
    recordedBy,
    allocations,
    createdAt: new Date().toISOString(),
    ...extra,
  });
}

/**
 * ชั่งปิดวัน — ปรับสต๊อกให้ตรงจริง ส่วนต่างที่หายไป (กุ้งกิน/เน่าไม่ชั่ง) = ของเสียใน P&L
 */
export async function reconcileStockToActual(
  stock,
  batches,
  actualLive,
  actualDead,
  updateMainStock,
  meta = {},
) {
  const system = batches.length > 0
    ? sumStockFromBatches(batches)
    : normalizeStockValues(stock?.live ?? 0, stock?.dead ?? 0);
  const actual = normalizeStockValues(actualLive, actualDead);
  const varianceLive = actual.live - system.live;
  const varianceDead = actual.dead - system.dead;
  const allAllocations = [];

  if (varianceLive < -0.001 && batches.length > 0) {
    const r = await deductSpoilageFromBatches(batches, Math.abs(varianceLive));
    allAllocations.push(...r.allocations);
  }
  if (varianceDead < -0.001 && batches.length > 0) {
    const r = await deductDeadSpoilageFromBatches(batches, Math.abs(varianceDead));
    allAllocations.push(...r.allocations);
  }

  if (batches.length > 0) {
    const refreshed = sumStockFromBatches(
      batches.map((b) => {
        const livePatch = allAllocations.find((a) => a.batchId === b.id);
        if (!livePatch) return b;
        const p = allAllocations.filter((x) => x.batchId === b.id);
        let remLive = parseFloat(b.remainingLiveKg ?? b.liveKg) || 0;
        let remDead = parseFloat(b.remainingDeadKg ?? b.deadKg) || 0;
        for (const x of p) {
          if (x.liveTaken) remLive -= x.liveTaken;
          if (x.deadTaken) remDead -= x.deadTaken;
          if (x.deadAdded) remDead += x.deadAdded;
        }
        return { ...b, remainingLiveKg: remLive, remainingDeadKg: remDead };
      }),
    );
    await updateMainStock(refreshed.live, refreshed.dead);
  } else {
    await updateMainStock(actual.live, actual.dead);
  }

  const shrinkKg = Math.max(0, -varianceLive) + Math.max(0, -varianceDead);
  const avgCost = estimateAvgCostPerKg(batches);
  const estimatedLossBaht = shrinkKg * avgCost;

  await logStockAdjustment({
    type: 'stock_count',
    weightKg: shrinkKg,
    note: meta.note,
    recordedBy: meta.recordedBy,
    allocations: allAllocations,
    extra: {
      systemLive: system.live,
      systemDead: system.dead,
      actualLive: actual.live,
      actualDead: actual.dead,
      varianceLive,
      varianceDead,
      estimatedLossBaht,
      avgCostPerKg: avgCost,
    },
  });

  return {
    system,
    actual,
    varianceLive,
    varianceDead,
    shrinkKg,
    estimatedLossBaht,
    allocations: allAllocations,
  };
}

export async function transferPondDeath(
  stock,
  transferKg,
  updateMainStock,
  batches = [],
  meta = {},
) {
  let allocations = [];
  if (batches.length > 0) {
    const result = await transferLiveToDeadInBatches(batches, transferKg);
    allocations = result.allocations;
    const patchById = Object.fromEntries(result.patches.map((p) => [p.id, p]));
    const summed = sumStockFromBatches(
      batches.map((b) => {
        const p = patchById[b.id];
        return p
          ? { ...b, remainingLiveKg: p.remainingLiveKg, remainingDeadKg: p.remainingDeadKg }
          : b;
      }),
    );
    await updateMainStock(summed.live, summed.dead);
  } else {
    await updateMainStock(
      Math.max(0, stock.live - transferKg),
      Math.max(0, stock.dead + transferKg),
    );
  }
  await logStockAdjustment({
    type: 'pond_to_dead',
    weightKg: transferKg,
    note: meta.note,
    recordedBy: meta.recordedBy,
    allocations,
  });
  return allocations;
}

/** บันทึกกุ้งเสียหาย (ไม่นำไปขาย) — หักน้ำหนักจากล็อตเก่าก่อน */
export async function recordSpoilageLoss(
  stock,
  lossKg,
  updateMainStock,
  batches = [],
  meta = {},
) {
  let allocations = [];
  if (batches.length > 0) {
    const result = await deductSpoilageFromBatches(batches, lossKg);
    allocations = result.allocations;
    const patchById = Object.fromEntries(result.patches.map((p) => [p.id, p]));
    const summed = sumStockFromBatches(
      batches.map((b) => {
        const p = patchById[b.id];
        return p ? { ...b, remainingLiveKg: p.remainingLiveKg, remainingDeadKg: p.remainingDeadKg } : b;
      }),
    );
    await updateMainStock(summed.live, summed.dead);
  } else {
    await updateMainStock(
      Math.max(0, stock.live - lossKg),
      stock.dead,
    );
  }
  await logStockAdjustment({
    type: 'spoilage_loss',
    weightKg: lossKg,
    note: meta.note,
    recordedBy: meta.recordedBy,
    allocations,
  });
  return allocations;
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

/**
 * รับกุ้งเข้า — บันทึกล็อต FIFO (เรียกหลังอัปเดตสต๊อกแล้ว)
 *
 * sizeBreakdown ตัวเลือก (ข้อมูลอ้างอิง ไม่กระทบ FIFO):
 *   { mode: 'mixed'|'by_size', A: kg, B: kg, C: kg }
 *   - mode='mixed'  → รวมไซต์ (ไม่ระบุขนาดย่อย)
 *   - mode='by_size' → แยก A/B/C โดยรวม A+B+C ต้องเท่ากับ liveKg
 */
export async function createStockBatchRecord({
  liveKg,
  deadKg,
  costPerKg,
  transport,
  note,
  sizeBreakdown = null,
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
    ...(sizeBreakdown ? { sizeBreakdown } : {}),
  }));
  return { grandTotal, effectiveCost };
}
