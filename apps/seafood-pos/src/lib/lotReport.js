import { saleDateKeyFromBill } from './date.js';
import { receiveDateKeyOf, groupBatchesByReceiveDay } from './stockBatchUtils';
import { aggregateDailySales } from './salesAggregate';

function kg(n) {
  return Math.max(0, parseFloat(n) || 0);
}

function baht(n) {
  return Math.max(0, parseFloat(n) || 0);
}

/** ล็อต = วันรับเข้า (receiveDateKey) */
export function batchesForLot(batches = [], lotDateKey) {
  return batches.filter((b) => receiveDateKeyOf(b) === lotDateKey);
}

export function listLotDateKeys(batches = []) {
  return groupBatchesByReceiveDay(batches).map((d) => d.dateKey);
}

function sumAdjustmentsForLot(adjustments = [], batchIds) {
  let pondToDeadKg = 0;
  let spoilageKg = 0;
  let stockCountKg = 0;
  let stockCountBaht = 0;

  for (const adj of adjustments) {
    const allocs = (adj.allocations || []).filter((a) => batchIds.has(a.batchId));
    if (!allocs.length) continue;

    if (adj.type === 'pond_to_dead') {
      for (const a of allocs) pondToDeadKg += kg(a.deadAdded ?? a.liveTaken);
    } else if (adj.type === 'spoilage_loss') {
      for (const a of allocs) spoilageKg += kg(a.liveTaken);
    } else if (adj.type === 'stock_count') {
      for (const a of allocs) {
        spoilageKg += kg(a.liveTaken) + kg(a.deadTaken);
      }
      stockCountKg += kg(adj.weightKg);
      stockCountBaht += baht(adj.estimatedLossBaht);
    }
  }

  return { pondToDeadKg, spoilageKg, stockCountKg, stockCountBaht };
}

/**
 * สรุปผลล็อต (รถรับเข้า 1 วัน) ในช่วงวันรับถึงวันปิด
 * ของเสีย = น้ำหนักที่หายจากล็อตโดยไม่นับเป็นยอดขาย (ปูกิน / เน่าไม่จด ฯลฯ)
 */
export function computeLotReport({
  lotDateKey,
  endDateKey,
  batches = [],
  sales = [],
  adjustments = [],
  countedLive = null,
  countedDead = null,
}) {
  const lotBatches = batchesForLot(batches, lotDateKey);
  const batchIds = new Set(lotBatches.map((b) => b.id));

  let receivedLive = 0;
  let receivedDead = 0;
  let totalCost = 0;
  let remainingLive = 0;
  let remainingDead = 0;

  for (const b of lotBatches) {
    receivedLive += kg(b.liveKg);
    receivedDead += kg(b.deadKg);
    totalCost += baht(b.totalCost);
    remainingLive += kg(b.remainingLiveKg ?? b.liveKg);
    remainingDead += kg(b.remainingDeadKg ?? b.deadKg);
  }

  const receivedTotalKg = receivedLive + receivedDead;
  const remainingTotalKg = remainingLive + remainingDead;
  const avgCostPerKg = receivedTotalKg > 0 ? totalCost / receivedTotalKg : 0;

  const periodSales = sales.filter((s) => {
    const dk = saleDateKeyFromBill(s);
    return dk && dk >= lotDateKey && dk <= endDateKey;
  });
  const salesAgg = aggregateDailySales(periodSales);
  const soldLiveKg = salesAgg.liveKg;
  const soldDeadKg = salesAgg.deadKg;
  const soldTotalKg = soldLiveKg + soldDeadKg;
  const revenue = salesAgg.revenueTotal;

  const adj = sumAdjustmentsForLot(adjustments, batchIds);

  /** สมดุลมวล: รับ − ขาย − คงเหลือ = ของหายจากล็อต */
  const shrinkageKg = Math.max(
    0,
    receivedTotalKg - soldTotalKg - remainingTotalKg,
  );
  const shrinkageBaht = shrinkageKg * avgCostPerKg;
  const spoilageBaht = adj.spoilageKg * avgCostPerKg;

  /** ต้นทุนขาย — กก.ตายใช้ต้นทุนเดียวกับกุ้งเป็น (ทุนล็อต) ไม่ใช่ราคาขายตาย */
  const liveCogs = soldLiveKg * avgCostPerKg;
  const deadCogs = soldDeadKg * avgCostPerKg;
  const cogsSold = liveCogs + deadCogs;
  const liveGrossProfit = salesAgg.liveRevenue - liveCogs;
  const deadGrossProfit = salesAgg.deadRevenue - deadCogs;
  const grossProfit = revenue - cogsSold;
  const pondToDeadCostBaht = adj.pondToDeadKg * avgCostPerKg;
  const totalLossBaht = shrinkageBaht + adj.stockCountBaht;
  const netLotProfit = grossProfit - totalLossBaht;

  let countVarianceKg = null;
  let countVarianceBaht = null;
  let countVarianceLiveKg = null;
  let countVarianceDeadKg = null;
  if (countedLive != null || countedDead != null) {
    const cLive = countedLive != null ? kg(countedLive) : 0;
    const cDead = countedDead != null ? kg(countedDead) : 0;
    const countedTotal = cLive + cDead;
    countVarianceKg = remainingTotalKg - countedTotal;
    countVarianceBaht = countVarianceKg * avgCostPerKg;
    countVarianceLiveKg = remainingLive - cLive;
    countVarianceDeadKg = remainingDead - cDead;
  }

  const otherLotsWithStock = batches.filter(
    (b) => receiveDateKeyOf(b) !== lotDateKey
      && (kg(b.remainingLiveKg ?? b.liveKg) > 0.01 || kg(b.remainingDeadKg ?? b.deadKg) > 0.01),
  );
  const newerLots = batches.filter(
    (b) => receiveDateKeyOf(b) > lotDateKey
      && (kg(b.liveKg) > 0 || kg(b.deadKg) > 0),
  );

  return {
    lotDateKey,
    endDateKey,
    batchCount: lotBatches.length,
    receivedLive,
    receivedDead,
    receivedTotalKg,
    totalCost,
    avgCostPerKg,
    remainingLive,
    remainingDead,
    remainingTotalKg,
    soldLiveKg,
    soldDeadKg,
    soldTotalKg,
    liveRevenue: salesAgg.liveRevenue,
    deadRevenue: salesAgg.deadRevenue,
    revenue,
    billCount: salesAgg.billCount,
    liveCogs,
    deadCogs,
    liveGrossProfit,
    deadGrossProfit,
    pondToDeadKg: adj.pondToDeadKg,
    pondToDeadCostBaht,
    spoilageKg: adj.spoilageKg,
    stockCountKg: adj.stockCountKg,
    stockCountBaht: adj.stockCountBaht,
    shrinkageKg,
    shrinkageBaht,
    spoilageBaht,
    cogsSold,
    grossProfit,
    totalLossBaht,
    netLotProfit,
    countVarianceKg,
    countVarianceBaht,
    countVarianceLiveKg,
    countVarianceDeadKg,
    warnings: {
      hasOtherLotStock: otherLotsWithStock.length > 0,
      hasNewerLot: newerLots.length > 0,
    },
  };
}
