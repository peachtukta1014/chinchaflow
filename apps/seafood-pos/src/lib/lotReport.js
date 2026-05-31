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

/**
 * รวมความเคลื่อนไหวสต๊อก (stockAdjustments) ที่อยู่ในล็อตนี้
 *
 * pond_to_dead   — ย้ายกุ้งเป็น → ตาย (ไม่ใช่ "หาย" — แค่เปลี่ยนประเภท)
 * spoilage_loss  — ตัดทิ้ง/เน่า (live เท่านั้น ในระบบปัจจุบัน)
 * stock_count    — ชั่งปิด: หักทั้ง live+dead ตามส่วนต่าง
 */
function sumAdjustmentsForLot(adjustments = [], batchIds) {
  let pondToDeadKg = 0;
  let spoilageLiveKg = 0;
  let spoilageDeadKg = 0;
  let stockCountLiveKg = 0;
  let stockCountDeadKg = 0;
  let stockCountKg = 0;
  let stockCountBaht = 0;
  let carryForwardLiveKg = 0;
  let carryForwardDeadKg = 0;

  for (const adj of adjustments) {
    const allocs = (adj.allocations || []).filter((a) => batchIds.has(a.batchId));
    if (!allocs.length) continue;

    if (adj.type === 'pond_to_dead') {
      for (const a of allocs) pondToDeadKg += kg(a.deadAdded ?? a.liveTaken);
    } else if (adj.type === 'spoilage_loss') {
      for (const a of allocs) spoilageLiveKg += kg(a.liveTaken);
    } else if (adj.type === 'stock_count') {
      for (const a of allocs) {
        stockCountLiveKg += kg(a.liveTaken);
        stockCountDeadKg += kg(a.deadTaken);
      }
      stockCountKg += kg(adj.weightKg);
      stockCountBaht += baht(adj.estimatedLossBaht);
    } else if (adj.type === 'lot_carry_forward') {
      for (const a of allocs) {
        carryForwardLiveKg += kg(a.liveTaken);
        carryForwardDeadKg += kg(a.deadTaken);
      }
    }
  }

  const spoilageKg = spoilageLiveKg + spoilageDeadKg;

  return {
    pondToDeadKg,
    spoilageKg,
    spoilageLiveKg,
    spoilageDeadKg,
    stockCountLiveKg,
    stockCountDeadKg,
    stockCountKg,
    stockCountBaht,
    carryForwardLiveKg,
    carryForwardDeadKg,
  };
}

/**
 * สรุปผลล็อต (รถรับเข้า 1 วัน) ในช่วงวันรับถึงวันปิด
 *
 * สมดุลมวล (น้ำหนัก):
 *   รับเข้า = ขาย + คงเหลือ + เสียหาย(จด) + ชั่งปิด(จด) + หายปริศนา
 *
 * กำไร/ขาดทุน:
 *   สุทธิสุดท้าย = (ขายได้ − ต้นทุนขาย)
 *                − ค่าใช้จ่ายดำเนิน (บ่อ+แผง)
 *                − ต้นทุนหายปริศนา
 *                − ต้นทุนเสียหาย(จด)
 *                − ต้นทุนชั่งปิด(จด)
 *
 * ⚠️  pond_to_dead ไม่ใช่ "สูญเสีย" — เป็นการแปลงประเภท live→dead
 *     จึงไม่นับรวมในการคำนวณกุ้งหาย
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

  // ── สมดุลมวลรวม (ตัวเลขถูกต้องเสมอ ใช้ใน weight section) ──────────────────
  // กุ้งหายรวม = รับ − ขาย − คงเหลือ − ยกล็อต (รวมที่จดไว้และปริศนา)
  const carryForwardTotalKg = adj.carryForwardLiveKg + adj.carryForwardDeadKg;
  const shrinkageKg = Math.max(
    0,
    receivedTotalKg - soldTotalKg - remainingTotalKg - carryForwardTotalKg,
  );

  // ── กุ้งหาย "ปริศนา" ต่อสาย (ไม่รวม pond_to_dead / spoilage / stock_count / carry_forward) ──
  //
  // สาย LIVE:  รับเป็น − ขายเป็น − คงเป็น − (ย้ายไปตาย) − (ตัดทิ้ง) − (ชั่งปิด live) − (ยกล็อต live)
  // สาย DEAD:  (รับตาย + ย้ายจากบ่อ) − ขายตาย − คงตาย − (ตัดทิ้งตาย) − (ชั่งปิด dead) − (ยกล็อต dead)
  const unaccountedLiveKg = Math.max(
    0,
    receivedLive - soldLiveKg - remainingLive
      - adj.pondToDeadKg - adj.spoilageLiveKg - adj.stockCountLiveKg - adj.carryForwardLiveKg,
  );
  const unaccountedDeadKg = Math.max(
    0,
    (receivedDead + adj.pondToDeadKg) - soldDeadKg - remainingDead
      - adj.spoilageDeadKg - adj.stockCountDeadKg - adj.carryForwardDeadKg,
  );
  const unaccountedShrinkageKg = unaccountedLiveKg + unaccountedDeadKg;

  // ── ต้นทุนสูญเสีย (ไม่นับซ้ำ) ───────────────────────────────────────────────
  const unaccountedLiveBaht = unaccountedLiveKg * liveCostPerKg;
  const unaccountedDeadBaht = unaccountedDeadKg * deadCostPerKgForCogs;

  // ต้นทุนเสียหาย/ตัดทิ้ง (จดแล้ว)
  const spoilageLiveBaht = adj.spoilageLiveKg * liveCostPerKg;
  const spoilageDeadBaht = adj.spoilageDeadKg * deadCostPerKgForCogs;
  const spoilageTotalBaht = spoilageLiveBaht + spoilageDeadBaht;

  // รวมต้นทุนสูญเสียทั้งหมด (ไม่นับซ้ำ):
  //   ปริศนา + เสียหาย(จด) + ชั่งปิด(จด)
  const shrinkageBaht = unaccountedLiveBaht + unaccountedDeadBaht + spoilageTotalBaht + adj.stockCountBaht;

  // ── COGS / กำไรขั้นต้น ──────────────────────────────────────────────────────
  const liveCogs = soldLiveKg * liveCostPerKg;
  const deadCogs = soldDeadKg * deadCostPerKgForCogs;
  const cogsSold = liveCogs + deadCogs;
  const liveGrossProfit = salesAgg.liveRevenue - liveCogs;
  const deadGrossProfit = salesAgg.deadRevenue - deadCogs;
  const grossProfit = revenue - cogsSold;

  // ── รายจ่ายดำเนิน ───────────────────────────────────────────────────────────
  const marketExpensesBaht = baht(marketExpenses);
  const pondExpensesBaht = baht(pondExpenses);
  const miscFromSplit = marketExpensesBaht + pondExpensesBaht;
  const miscExpensesBaht = miscFromSplit > 0 ? miscFromSplit : baht(miscExpenses);

  // ── สุทธิแต่ละสาย ────────────────────────────────────────────────────────────
  // per-line ใช้เฉพาะกุ้งหายปริศนา (unaccounted); spoilage+stock_count อยู่ใน summary
  const liveWeightLossKg = unaccountedLiveKg;
  const deadWeightLossKg = unaccountedDeadKg;
  const liveWeightLossBaht = unaccountedLiveBaht;
  const deadWeightLossBaht = unaccountedDeadBaht;

  const liveLineNetBaht = liveGrossProfit - pondExpensesBaht - liveWeightLossBaht;
  const deadLineNetBaht = deadGrossProfit - marketExpensesBaht - deadWeightLossBaht;
  const combinedLineNetBaht = liveLineNetBaht + deadLineNetBaht;

  // ── สุทธิสุดท้าย (ไม่นับซ้ำ) ────────────────────────────────────────────────
  // รวมสองสาย + รายได้รายการอื่น (ไม่มี COGS กุ้ง) − เสียหาย(จด) − ชั่งปิด(จด)
  const otherRevenueBaht = baht(salesAgg.otherRevenue);
  const netAfterMisc =
    combinedLineNetBaht + otherRevenueBaht - spoilageTotalBaht - adj.stockCountBaht;

  // legacy alias
  const totalLossBaht = shrinkageBaht;
  const netLotProfit = netAfterMisc;
  const pondToDeadCostBaht = adj.pondToDeadKg * liveCostPerKg;
  const spoilageBaht = spoilageTotalBaht;

  // ── ส่วนต่างชั่งจริง ─────────────────────────────────────────────────────────
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
    // น้ำหนัก
    shrinkageKg,               // กุ้งหายรวม (รวมที่จดและปริศนา) — ใช้ใน weight section
    unaccountedShrinkageKg,    // กุ้งหายปริศนา (ไม่ได้จดไว้เลย)
    shrinkageLiveKg: unaccountedLiveKg,   // legacy name = unaccounted live เท่านั้น
    shrinkageDeadKg: unaccountedDeadKg,   // legacy name = unaccounted dead เท่านั้น
    remainingLive,
    remainingDead,
    remainingTotalKg,
    soldLiveKg,
    soldDeadKg,
    soldTotalKg,
    liveRevenue: salesAgg.liveRevenue,
    deadRevenue: salesAgg.deadRevenue,
    otherRevenueBaht,
    revenue,
    billCount: salesAgg.billCount,
    liveCogs,
    deadCogs,
    liveGrossProfit,
    deadGrossProfit,
    // การเคลื่อนไหวที่บันทึกแล้ว
    pondToDeadKg: adj.pondToDeadKg,
    pondToDeadCostBaht,
    spoilageKg: adj.spoilageKg,
    spoilageLiveKg: adj.spoilageLiveKg,
    spoilageDeadKg: adj.spoilageDeadKg,
    spoilageBaht,       // alias ของ spoilageTotalBaht
    spoilageTotalBaht,  // ต้นทุนเสียหาย/ตัดทิ้ง (จดแล้ว)
    stockCountKg: adj.stockCountKg,
    stockCountLiveKg: adj.stockCountLiveKg,
    stockCountDeadKg: adj.stockCountDeadKg,
    stockCountBaht: adj.stockCountBaht,
    carryForwardLiveKg: adj.carryForwardLiveKg,
    carryForwardDeadKg: adj.carryForwardDeadKg,
    carryForwardTotalKg,
    // ต้นทุนสูญเสีย (ไม่นับซ้ำ)
    shrinkageBaht,    // = unaccounted + spoilage + stockCount
    totalLossBaht,    // alias
    // กำไร/ขาดทุน
    cogsSold,
    grossProfit,
    marketExpensesBaht,
    pondExpensesBaht,
    miscExpensesBaht,
    liveWeightLossKg,
    deadWeightLossKg,
    liveWeightLossBaht,
    deadWeightLossBaht,
    liveLineNetBaht,
    deadLineNetBaht,
    combinedLineNetBaht,
    netAfterMisc,     // สุทธิสุดท้าย (ถูกต้อง ไม่นับซ้ำ)
    netLotProfit,     // alias
    // ชั่งปิดจริง
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
