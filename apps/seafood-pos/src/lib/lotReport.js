import { saleDateKeyFromBill } from './date.js';
import { computeLotCostTotals } from './lotCostSplit.js';
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
  let spoilageLiveKg = 0;
  let spoilageDeadKg = 0;
  let stockCountKg = 0;
  let stockCountBaht = 0;

  for (const adj of adjustments) {
    const allocs = (adj.allocations || []).filter((a) => batchIds.has(a.batchId));
    if (!allocs.length) continue;

    if (adj.type === 'pond_to_dead') {
      for (const a of allocs) pondToDeadKg += kg(a.deadAdded ?? a.liveTaken);
    } else if (adj.type === 'spoilage_loss') {
      for (const a of allocs) spoilageLiveKg += kg(a.liveTaken);
    } else if (adj.type === 'stock_count') {
      for (const a of allocs) {
        spoilageLiveKg += kg(a.liveTaken);
        spoilageDeadKg += kg(a.deadTaken);
      }
      stockCountKg += kg(adj.weightKg);
      stockCountBaht += baht(adj.estimatedLossBaht);
    }
  }

  const spoilageKg = spoilageLiveKg + spoilageDeadKg;

  return {
    pondToDeadKg,
    spoilageKg,
    spoilageLiveKg,
    spoilageDeadKg,
    stockCountKg,
    stockCountBaht,
  };
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
  miscExpenses = 0,
  marketExpenses = 0,
  pondExpenses = 0,
}) {
  const lotBatches = batchesForLot(batches, lotDateKey);
  const batchIds = new Set(lotBatches.map((b) => b.id));

  let remainingLive = 0;
  let remainingDead = 0;

  for (const b of lotBatches) {
    remainingLive += kg(b.remainingLiveKg ?? b.liveKg);
    remainingDead += kg(b.remainingDeadKg ?? b.deadKg);
  }

  const costTotals = computeLotCostTotals(lotBatches);
  const {
    receivedLive,
    receivedDead,
    totalCost,
    transportTotal,
    shrimpPurchaseCost,
    liveCostBaht,
    deadCostBaht,
    liveCostPerKg,
    deadCostPerKg,
    deadCostPerKgForCogs,
  } = costTotals;

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
  const shrinkageLiveKg = Math.max(0, receivedLive - soldLiveKg - remainingLive);
  const shrinkageDeadKg = Math.max(0, receivedDead - soldDeadKg - remainingDead);
  const shrinkageBaht = shrinkageLiveKg * liveCostPerKg + shrinkageDeadKg * deadCostPerKgForCogs;
  const spoilageBaht = adj.spoilageKg * liveCostPerKg;

  const liveCogs = soldLiveKg * liveCostPerKg;
  const deadCogs = soldDeadKg * deadCostPerKgForCogs;
  const cogsSold = liveCogs + deadCogs;
  const liveGrossProfit = salesAgg.liveRevenue - liveCogs;
  const deadGrossProfit = salesAgg.deadRevenue - deadCogs;
  const grossProfit = revenue - cogsSold;
  const pondToDeadCostBaht = adj.pondToDeadKg * liveCostPerKg;
  const totalLossBaht = shrinkageBaht + adj.stockCountBaht;
  const netLotProfit = grossProfit - totalLossBaht;
  const marketExpensesBaht = baht(marketExpenses);
  const pondExpensesBaht = baht(pondExpenses);
  const miscFromSplit = marketExpensesBaht + pondExpensesBaht;
  const miscExpensesBaht = miscFromSplit > 0 ? miscFromSplit : baht(miscExpenses);

  /** สายกุ้งเป็น / ตาย — ทุนรับเข้า − รายจ่ายสาย (มุมทุน) */
  const liveCapitalAfterExpenses = liveCostBaht - pondExpensesBaht;
  const deadCapitalAfterExpenses = deadCostBaht - marketExpensesBaht;

  /** ขาดทุนน้ำหนักแยกสาย (รับ − ขาย − คงเหลือ) */
  const liveWeightLossKg = shrinkageLiveKg;
  const deadWeightLossKg = shrinkageDeadKg;
  const liveWeightLossBaht = liveWeightLossKg * liveCostPerKg;
  const deadWeightLossBaht = deadWeightLossKg * deadCostPerKgForCogs;
  const totalWeightLossKg = liveWeightLossKg + deadWeightLossKg;

  /**
   * สุทธิสาย (มุมกำไร): รายได้ขาย − ต้นทุนขาย − รายจ่ายสาย − มูลค่ากุ้งหาย (กก.)
   */
  const liveLineNetBaht = liveGrossProfit - pondExpensesBaht - liveWeightLossBaht;
  const deadLineNetBaht = deadGrossProfit - marketExpensesBaht - deadWeightLossBaht;
  const combinedLineNetBaht = liveLineNetBaht + deadLineNetBaht;

  const netAfterMisc = netLotProfit - miscExpensesBaht;

  let countVarianceKg = null;
  let countVarianceBaht = null;
  let countVarianceLiveKg = null;
  let countVarianceDeadKg = null;
  if (countedLive != null || countedDead != null) {
    const cLive = countedLive != null ? kg(countedLive) : 0;
    const cDead = countedDead != null ? kg(countedDead) : 0;
    const countedTotal = cLive + cDead;
    countVarianceKg = remainingTotalKg - countedTotal;
    const blendCost = remainingTotalKg > 0.001
      ? (liveCostPerKg * remainingLive + deadCostPerKgForCogs * remainingDead) / remainingTotalKg
      : avgCostPerKg;
    countVarianceBaht = countVarianceKg * blendCost;
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
    transportTotal,
    shrimpPurchaseCost,
    liveCostBaht,
    deadCostBaht,
    liveCostPerKg,
    deadCostPerKg,
    deadCostPerKgForCogs,
    avgCostPerKg,
    shrinkageLiveKg,
    shrinkageDeadKg,
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
    marketExpensesBaht,
    pondExpensesBaht,
    miscExpensesBaht,
    netAfterMisc,
    liveCapitalAfterExpenses,
    deadCapitalAfterExpenses,
    liveLineNetBaht,
    deadLineNetBaht,
    combinedLineNetBaht,
    liveWeightLossKg,
    deadWeightLossKg,
    liveWeightLossBaht,
    deadWeightLossBaht,
    totalWeightLossKg,
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
