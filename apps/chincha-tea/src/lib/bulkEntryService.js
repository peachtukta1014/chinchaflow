import { fsPost } from './firestoreRest';
import { staffSnapshot, writeHistoryLog } from './historyLogService';

function moneyValue(v) {
  const n = Math.round(Number(v) || 0);
  return n > 0 ? n : 0;
}

function intValue(v) {
  const n = Math.round(Number(v) || 0);
  return n > 0 ? n : 0;
}

export function sumBulkEntries(rows = []) {
  return rows.reduce((acc, row) => {
    acc.manualBulkTotal += moneyValue(row.manualBulkTotal ?? row.manual_bulk_total ?? row.total ?? row.bulkTotal);
    acc.manualCupsSold += intValue(row.manualCupsSold ?? row.manual_cups_sold ?? row.cupsSold ?? row.cups);
    acc.count += 1;
    return acc;
  }, { manualBulkTotal: 0, manualCupsSold: 0, count: 0 });
}

export async function saveBulkEntry({ dateKey, manualBulkTotal, manualCupsSold, note, member }) {
  const total = moneyValue(manualBulkTotal);
  const cups = intValue(manualCupsSold);
  if (!dateKey || total <= 0) throw new Error('invalid_bulk_entry');
  const now = new Date().toISOString();
  const payload = {
    dateKey,
    type: 'bulkEntry',
    entryMode: 'bulkEntry',
    description: 'บันทึกยอดเหมา',
    amount: 0,
    manualBulkTotal: total,
    manual_bulk_total: total,
    manualCupsSold: cups,
    manual_cups_sold: cups,
    note: note || '',
    createdBy: member?.name || 'ชินชา',
    createdByUid: member?.uid || '',
    updatedBy: member?.name || 'ชินชา',
    updatedByUid: member?.uid || '',
    ...staffSnapshot(member),
    createdAt: now,
    updatedAt: now,
  };
  const created = await fsPost('dailyExpenses', payload);
  await writeHistoryLog({
    action: 'bulkEntry.create',
    collection: 'dailyExpenses',
    docId: created.id,
    refPath: `dailyExpenses/${created.id}`,
    dateKey,
    member,
    summary: { manualBulkTotal: total, manualCupsSold: cups },
  });
  return created;
}
