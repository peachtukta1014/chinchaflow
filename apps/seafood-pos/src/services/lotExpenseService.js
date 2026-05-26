import { fsGetDoc, fsSetDoc } from '../lib/firestoreRest';
import { batchesForLot } from '../lib/lotReport';

export const EMPTY_LOT_EXPENSES = {
  marketExpenses: 0,
  marketNote: '',
  pondExpenses: 0,
  pondNote: '',
};

/** แปลงจาก Firestore (รองรับข้อมูลเก่า miscExpenses ช่องเดียว) */
export function normalizeLotExpenses(doc) {
  if (!doc) return { ...EMPTY_LOT_EXPENSES };
  const market = parseFloat(doc.marketExpenses) || 0;
  const pond = parseFloat(doc.pondExpenses) || 0;
  const legacy = parseFloat(doc.miscExpenses) || 0;
  if (market <= 0 && pond <= 0 && legacy > 0) {
    return {
      marketExpenses: 0,
      marketNote: '',
      pondExpenses: legacy,
      pondNote: String(doc.miscNote || doc.pondNote || ''),
    };
  }
  return {
    marketExpenses: market,
    marketNote: String(doc.marketNote || ''),
    pondExpenses: pond,
    pondNote: String(doc.pondNote || ''),
  };
}

export function totalMiscExpenses(exp) {
  return (parseFloat(exp?.marketExpenses) || 0) + (parseFloat(exp?.pondExpenses) || 0);
}

export function sumLotTransport(batches, lotDateKey) {
  return batchesForLot(batches, lotDateKey).reduce(
    (s, b) => s + (parseFloat(b.transport) || 0),
    0,
  );
}

/** ค่าใช้จ่ายแยกฝั่ง — doc id = receiveDateKey ล็อต */
export async function fetchLotExpenses(lotDateKey) {
  if (!lotDateKey) return { ...EMPTY_LOT_EXPENSES };
  const doc = await fsGetDoc(`lotExpenses/${lotDateKey}`);
  return normalizeLotExpenses(doc);
}

export async function saveLotExpenses(lotDateKey, expenses) {
  if (!lotDateKey) throw new Error('ไม่พบวันล็อต');
  const market = Math.max(0, parseFloat(expenses.marketExpenses) || 0);
  const pond = Math.max(0, parseFloat(expenses.pondExpenses) || 0);
  await fsSetDoc(`lotExpenses/${lotDateKey}`, {
    lotDateKey,
    marketExpenses: market,
    marketNote: String(expenses.marketNote || '').trim(),
    pondExpenses: pond,
    pondNote: String(expenses.pondNote || '').trim(),
    miscExpenses: market + pond,
    updatedAt: new Date().toISOString(),
  });
}
