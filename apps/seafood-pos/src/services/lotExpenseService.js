import { fsGetDoc, fsSetDoc } from '../lib/firestoreRest';
import { batchesForLot } from '../lib/lotReport';
import {
  formStateToLines,
  normalizeExpenseLinesFromDoc,
  sumExpenseLines,
} from '../lib/lotExpenseLines';

export const EMPTY_LOT_EXPENSES = {
  marketExpenses: 0,
  marketNote: '',
  marketLines: [],
  pondExpenses: 0,
  pondNote: '',
  pondLines: [],
};

function buildSide(docLines, amountField, noteField) {
  const lines = normalizeExpenseLinesFromDoc(
    docLines,
    amountField,
    noteField,
  );
  const total = sumExpenseLines(lines);
  const noteFromLines = lines
    .filter((l) => l.amount > 0)
    .map((l) => `${l.label} ${l.amount}`)
    .join(' \u00b7 ');
  const note = noteFromLines || String(noteField || '').trim();
  return { lines, total, note };
}

/** แปลงจาก Firestore (รองรับข้อมูลเก่า miscExpenses / ยอด+หมายเหตุเดียว) */
export function normalizeLotExpenses(doc) {
  if (!doc) return { ...EMPTY_LOT_EXPENSES };

  const legacy = parseFloat(doc.miscExpenses) || 0;
  let marketAmt = parseFloat(doc.marketExpenses) || 0;
  let pondAmt = parseFloat(doc.pondExpenses) || 0;
  let marketNote = String(doc.marketNote || '');
  let pondNote = String(doc.pondNote || '');

  if (marketAmt <= 0 && pondAmt <= 0 && legacy > 0) {
    pondAmt = legacy;
    pondNote = String(doc.miscNote || doc.pondNote || '');
  }

  const market = buildSide(doc.marketLines, marketAmt, marketNote);
  const pond = buildSide(doc.pondLines, pondAmt, pondNote);

  return {
    marketExpenses: market.total,
    marketNote: market.note,
    marketLines: market.lines,
    pondExpenses: pond.total,
    pondNote: pond.note,
    pondLines: pond.lines,
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

  const marketLines = formStateToLines(
    expenses.marketLines?.length
      ? expenses.marketLines
      : expenses.marketLinesForm,
  );
  const pondLines = formStateToLines(
    expenses.pondLines?.length
      ? expenses.pondLines
      : expenses.pondLinesForm,
  );

  const market = sumExpenseLines(marketLines);
  const pond = sumExpenseLines(pondLines);
  const marketNote = marketLines
    .map((l) => (l.amount > 0 ? `${l.label} ${l.amount}` : l.label))
    .filter(Boolean)
    .join(' \u00b7 ');
  const pondNote = pondLines
    .map((l) => (l.amount > 0 ? `${l.label} ${l.amount}` : l.label))
    .filter(Boolean)
    .join(' \u00b7 ');

  await fsSetDoc(`lotExpenses/${lotDateKey}`, {
    lotDateKey,
    marketLines,
    marketExpenses: market,
    marketNote,
    pondLines,
    pondExpenses: pond,
    pondNote,
    miscExpenses: market + pond,
    updatedAt: new Date().toISOString(),
  });

  return normalizeLotExpenses({
    marketLines,
    marketExpenses: market,
    marketNote,
    pondLines,
    pondExpenses: pond,
    pondNote,
  });
}
