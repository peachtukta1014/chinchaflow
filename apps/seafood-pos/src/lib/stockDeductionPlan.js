import { STOCK_LINE } from '../constants/stockLines.js';
import { sortBatchesFifoOrder } from './stockBatchUtils.js';

export function normalizeStockValues(live, dead) {
  return {
    live: Math.max(0, parseFloat(Number(live).toFixed(3))),
    dead: Math.max(0, parseFloat(Number(dead).toFixed(3))),
  };
}

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
 * คำนวณการตัด FIFO ใน memory (ยังไม่เขียน Firestore)
 */
export function planFifoBatchDeduction(batches, { liveKg, deadKg }) {
  let liveLeft = liveKg;
  let deadLeft = deadKg;
  const patches = [];
  const patchById = {};

  for (const b of sortBatchesFifoOrder(batches)) {
    if (liveLeft <= 0 && deadLeft <= 0) break;
    const remLive = parseFloat(b.remainingLiveKg ?? b.liveKg) || 0;
    const remDead = parseFloat(b.remainingDeadKg ?? b.deadKg) || 0;
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
      const patch = {
        id: b.id,
        remainingLiveKg: normalizeStockValues(newLive, 0).live,
        remainingDeadKg: normalizeStockValues(0, newDead).dead,
        _kgTypes: b._fsKgTypes || {},
      };
      patches.push(patch);
      patchById[b.id] = patch;
    }
  }

  if (liveLeft > 0.001 || deadLeft > 0.001) {
    throw new Error(
      `สต๊อกในล็อตไม่พอ (ขาด ${STOCK_LINE.live.tag} ${liveLeft.toFixed(2)} กก. / ${STOCK_LINE.dead.tag} ${deadLeft.toFixed(2)} กก.)`,
    );
  }

  const batchesAfter = batches.map((b) => {
    const p = patchById[b.id];
    if (!p) return b;
    return {
      ...b,
      remainingLiveKg: p.remainingLiveKg,
      remainingDeadKg: p.remainingDeadKg,
    };
  });

  return { patches, batchesAfter };
}

/** ยอดสต๊อกหลังตัดขาย — ใช้คืนสต๊อกเมื่อบันทึกล้มเหลว */
export function computeStockAfterSaleDeduction(avail, liveKg, deadKg, batches = []) {
  if (batches.length > 0) {
    const { batchesAfter } = planFifoBatchDeduction(batches, { liveKg, deadKg });
    const summed = sumStockFromBatches(batchesAfter);
    const stock = normalizeStockValues(summed.live, summed.dead);
    return { stock, batches: batchesAfter };
  }
  return {
    stock: {
      live: Math.max(0, avail.live - liveKg),
      dead: Math.max(0, avail.dead - deadKg),
    },
    batches,
  };
}
