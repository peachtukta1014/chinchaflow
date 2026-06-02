import { dateKeyBangkok } from './date.js';
import { batchLineMetrics } from './lotCostSplit.js';
import { groupBatchesByReceiveDay } from './stockBatchUtils.js';

function n(v) {
  return parseFloat(v) || 0;
}

/** มูลค่าทุนคงคลัง (ตามต้นทุนรับเข้า แยกสายเป็น/ตาย) */
export function computeRemainingInventoryBaht(batches = []) {
  let baht = 0;
  let liveKg = 0;
  let deadKg = 0;

  for (const b of batches) {
    const liveM = batchLineMetrics(b, 'live');
    const deadM = batchLineMetrics(b, 'dead');
    liveKg += liveM.remainingKg;
    deadKg += deadM.remainingKg;
    baht += liveM.remainingKg * liveM.costPerKg + deadM.remainingKg * deadM.costPerKg;
  }

  return {
    baht: Math.round(baht * 100) / 100,
    liveKg,
    deadKg,
    totalKg: liveKg + deadKg,
  };
}

/** รวม P&L จากล็อตที่ปิดแล้ว (snapshot lotSummaries) */
export function aggregateClosedLots(summaries = []) {
  return summaries.reduce(
    (acc, s) => ({
      count: acc.count + 1,
      totalCost: acc.totalCost + n(s.totalCost),
      revenue: acc.revenue + n(s.revenue),
      grossProfit: acc.grossProfit + n(s.grossProfit),
      netProfit: acc.netProfit + n(s.netLotProfit),
      shrinkageBaht: acc.shrinkageBaht + n(s.shrinkageBaht),
      receivedKg: acc.receivedKg + n(s.receivedTotalKg),
      soldKg: acc.soldKg + n(s.soldTotalKg),
    }),
    {
      count: 0,
      totalCost: 0,
      revenue: 0,
      grossProfit: 0,
      netProfit: 0,
      shrinkageBaht: 0,
      receivedKg: 0,
      soldKg: 0,
    },
  );
}

function monthKeyOf(lotDateKey) {
  if (!lotDateKey || lotDateKey.length < 7) return '';
  return lotDateKey.slice(0, 7);
}

function yearKeyOf(lotDateKey) {
  if (!lotDateKey || lotDateKey.length < 4) return '';
  return lotDateKey.slice(0, 4);
}

/** กรองล็อตตามช่วงเวลา (อิงวันรับรถ lotDateKey, timezone กรุงเทพ) */
export function filterSummariesByPeriod(summaries = [], period = 'all', todayKey = dateKeyBangkok()) {
  if (period === 'all') return [...summaries];
  const monthKey = todayKey.slice(0, 7);
  const yearKey = todayKey.slice(0, 4);
  return summaries.filter((s) => {
    const dk = s.lotDateKey || '';
    if (period === 'month') return monthKeyOf(dk) === monthKey;
    if (period === 'year') return yearKeyOf(dk) === yearKey;
    return true;
  });
}

function bucketSummaries(summaries, keyFn) {
  const map = new Map();
  for (const s of summaries) {
    const key = keyFn(s.lotDateKey);
    if (!key) continue;
    const prev = map.get(key) || { key, summaries: [] };
    prev.summaries.push(s);
    map.set(key, prev);
  }
  return [...map.values()]
    .map(({ key, summaries: rows }) => ({
      key,
      ...aggregateClosedLots(rows),
      lotCount: rows.length,
    }))
    .sort((a, b) => b.key.localeCompare(a.key));
}

export function bucketSummariesByMonth(summaries = []) {
  return bucketSummaries(summaries, monthKeyOf);
}

export function bucketSummariesByYear(summaries = []) {
  return bucketSummaries(summaries, yearKeyOf);
}

/** ล็อตที่ยังมีสต๊อกแต่ยังไม่ปิด (ยังไม่มี lotSummaries closed) */
export function countOpenLots(stockBatches = [], closedLotKeys = new Set()) {
  const days = groupBatchesByReceiveDay(stockBatches);
  return days.filter((d) => {
    if (closedLotKeys.has(d.dateKey)) return false;
    return (d.remainingLive || 0) > 0.01 || (d.remainingDead || 0) > 0.01;
  }).length;
}

/**
 * ภาพรวมพอร์ตล็อต — ใช้ในแท็บ「ภาพรวม」
 *
 * @param {object} opts
 * @param {Array} opts.closedSummaries — จาก lotSummaries (ปิดแล้ว)
 * @param {Array} opts.stockBatches — batches ปัจจุบัน
 * @param {Set<string>} opts.closedLotKeys
 * @param {'all'|'year'|'month'} opts.period
 */
export function computePortfolioOverview({
  closedSummaries = [],
  stockBatches = [],
  closedLotKeys = new Set(),
  period = 'all',
}) {
  const filtered = filterSummariesByPeriod(closedSummaries, period);
  const closed = aggregateClosedLots(filtered);
  const inventory = computeRemainingInventoryBaht(stockBatches);
  const openLotCount = countOpenLots(stockBatches, closedLotKeys);
  const avgNetPerLot = closed.count > 0 ? closed.netProfit / closed.count : 0;
  const roiPct = closed.totalCost > 0 ? (closed.netProfit / closed.totalCost) * 100 : 0;

  return {
    period,
    closed,
    inventory,
    openLotCount,
    avgNetPerLot,
    roiPct,
    byMonth: bucketSummariesByMonth(filtered),
    byYear: bucketSummariesByYear(filtered),
    recentLots: [...filtered]
      .sort((a, b) => String(b.lotDateKey).localeCompare(String(a.lotDateKey)))
      .slice(0, 8),
  };
}

export function formatMonthLabel(monthKey) {
  if (!monthKey || monthKey.length < 7) return monthKey;
  const d = new Date(`${monthKey}-01T12:00:00+07:00`);
  if (Number.isNaN(d.getTime())) return monthKey;
  return d.toLocaleDateString('th-TH', { month: 'short', year: '2-digit', timeZone: 'Asia/Bangkok' });
}

export function formatYearLabel(yearKey) {
  if (!yearKey) return yearKey;
  const y = parseInt(yearKey, 10);
  if (!y) return yearKey;
  return `พ.ศ. ${y + 543}`;
}
