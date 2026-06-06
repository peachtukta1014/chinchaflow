/**
 * ปิดล็อตกุ้ง — บันทึก P&L สุดท้าย + ยกยอดคงเหลือไปล็อตถัดไป
 *
 * flow (atomic :commit เดียว):
 *  1. zeroes remaining kg on source lot batches
 *  2. creates a carry-forward batch in target lot (same avg cost)
 *  3. logs stockAdjustments type=lot_carry_forward
 *  4. saves snapshot to lotSummaries/{lotDateKey}
 */
import { dateKeyBangkok } from '../lib/date';
import {
  fsCommitWrites,
  fsDocName,
  fsGetDoc,
  fsObj,
  fsObjStockFields,
  fsRunQuery,
} from '../lib/firestoreRest';
import { batchesForLot } from '../lib/lotReport';
import { receiveDateKeyOf } from '../lib/stockBatchUtils';

function kg(n) {
  return Math.max(0, parseFloat(n) || 0);
}

function newDocId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * ปิดล็อต + ยกยอดไปล็อตถัดไป
 *
 * @param {string}  lotDateKey        - วันรับรถที่ต้องการปิด (YYYY-MM-DD)
 * @param {Array}   batches           - stockBatches ทั้งหมด (from App state)
 * @param {object}  report            - ผลจาก computeLotReport (สำหรับ snapshot)
 * @param {string}  targetLotDateKey  - ล็อตปลายทางที่รับยอดยกไป
 * @param {string}  closedBy          - ชื่อผู้ปิดล็อต
 */
export async function closeLotAndCarryForward({
  lotDateKey,
  batches,
  report,
  targetLotDateKey,
  closedBy = '',
}) {
  const sourceBatches = batchesForLot(batches, lotDateKey);
  if (!sourceBatches.length) throw new Error('ไม่พบล็อตที่ต้องการปิด');

  const carryLive = sourceBatches.reduce((s, b) => s + kg(b.remainingLiveKg ?? b.liveKg), 0);
  const carryDead = sourceBatches.reduce((s, b) => s + kg(b.remainingDeadKg ?? b.deadKg), 0);
  const hasCarry = carryLive > 0.001 || carryDead > 0.001;
  const closedAt = new Date().toISOString();

  const allocations = sourceBatches.map((b) => ({
    batchId: b.id,
    receiveDateKey: receiveDateKeyOf(b),
    batchNote: b.note || '',
    liveTaken: kg(b.remainingLiveKg ?? b.liveKg),
    deadTaken: kg(b.remainingDeadKg ?? b.deadKg),
  }));

  const writes = sourceBatches.map((b) => ({
    update: {
      name: fsDocName('stockBatches', b.id),
      fields: fsObjStockFields({
        remainingLiveKg: 0,
        remainingDeadKg: 0,
        _fsKgTypes: b._fsKgTypes || b._kgTypes,
      }),
    },
    updateMask: { fieldPaths: ['remainingLiveKg', 'remainingDeadKg'] },
  }));

  if (hasCarry && targetLotDateKey) {
    const avgCost = report.avgCostPerKg || 0;
    writes.push({
      update: {
        name: fsDocName('stockBatches', newDocId()),
        fields: fsObjStockFields({
          receiveDateKey: targetLotDateKey,
          purchaseDate: closedAt,
          liveKg: carryLive,
          deadKg: carryDead,
          remainingLiveKg: carryLive,
          remainingDeadKg: carryDead,
          costPerKg: avgCost,
          transport: 0,
          totalCost: Math.round((carryLive + carryDead) * avgCost * 100) / 100,
          effectiveCostPerKg: avgCost,
          note: `ยกยอดจากล็อต ${lotDateKey}`,
          isCarryForward: true,
          sourceReceiveDateKey: lotDateKey,
        }),
      },
      currentDocument: { exists: false },
    });
  }

  writes.push({
    update: {
      name: fsDocName('stockAdjustments', newDocId()),
      fields: fsObj({
        type: 'lot_carry_forward',
        dateKey: dateKeyBangkok(),
        sourceLotDateKey: lotDateKey,
        targetLotDateKey: targetLotDateKey || null,
        carryLiveKg: carryLive,
        carryDeadKg: carryDead,
        weightKg: carryLive + carryDead,
        note: `ปิดล็อต ${lotDateKey}${targetLotDateKey ? ` → ยกไป ${targetLotDateKey}` : ''}`,
        recordedBy: closedBy,
        allocations,
        createdAt: closedAt,
      }),
    },
    currentDocument: { exists: false },
  });

  writes.push({
    update: {
      name: fsDocName('lotSummaries', lotDateKey),
      fields: fsObj({
        lotDateKey,
        closedAt,
        closedBy,
        status: 'closed',
        receivedLive: report.receivedLive,
        receivedDead: report.receivedDead,
        receivedTotalKg: report.receivedTotalKg,
        totalCost: report.totalCost,
        avgCostPerKg: report.avgCostPerKg,
        soldLiveKg: report.soldLiveKg,
        soldDeadKg: report.soldDeadKg,
        soldTotalKg: report.soldTotalKg,
        revenue: report.revenue,
        cogsSold: report.cogsSold,
        grossProfit: report.grossProfit,
        marketExpensesBaht: report.marketExpensesBaht,
        pondExpensesBaht: report.pondExpensesBaht,
        miscExpensesBaht: report.miscExpensesBaht,
        shrinkageKg: report.shrinkageKg,
        shrinkageBaht: report.shrinkageBaht,
        netLotProfit: report.netLotProfit,
        liveLineNetBaht: report.liveLineNetBaht,
        deadLineNetBaht: report.deadLineNetBaht,
        carryLiveKg: carryLive,
        carryDeadKg: carryDead,
        targetLotDateKey: hasCarry && targetLotDateKey ? targetLotDateKey : null,
      }),
    },
    currentDocument: { exists: false },
  });

  await fsCommitWrites(writes);
  return { carryLive, carryDead };
}

/** โหลดรายการล็อตที่ปิดแล้วทั้งหมด (เรียงใหม่→เก่า) */
export async function fetchLotSummaries(limit = 50) {
  try {
    const rows = await fsRunQuery({
      from: [{ collectionId: 'lotSummaries' }],
      orderBy: [{ field: { fieldPath: 'lotDateKey' }, direction: 'DESCENDING' }],
      limit,
    });
    return rows;
  } catch (e) {
    console.warn('fetchLotSummaries', e);
    return [];
  }
}

/** ตรวจสอบว่าล็อตนี้ปิดแล้วหรือยัง */
export async function isLotClosed(lotDateKey) {
  try {
    const doc = await fsGetDoc(`lotSummaries/${lotDateKey}`);
    return doc?.status === 'closed';
  } catch {
    return false;
  }
}

/** หาล็อตที่เหมาะสมที่สุดสำหรับรับยอดยกมา (ใหม่สุด != source) */
export function pickCarryTarget(batches, sourceLotDateKey) {
  const sorted = [...batches].sort((a, b) => {
    const da = receiveDateKeyOf(a);
    const db = receiveDateKeyOf(b);
    return db.localeCompare(da);
  });
  const other = sorted.find((b) => receiveDateKeyOf(b) !== sourceLotDateKey);
  return other ? receiveDateKeyOf(other) : null;
}
