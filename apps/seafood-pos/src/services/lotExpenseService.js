import { fsGetDoc, fsSetDoc } from '../lib/firestoreRest';

/** ค่าใช้จ่ายจิปาถะต่อล็อต (ค่าลูก น้ำมัน ฯลฯ) — doc id = receiveDateKey */
export async function fetchLotExpenses(lotDateKey) {
  if (!lotDateKey) return { miscExpenses: 0, miscNote: '' };
  const doc = await fsGetDoc(`lotExpenses/${lotDateKey}`);
  if (!doc) return { miscExpenses: 0, miscNote: '' };
  return {
    miscExpenses: parseFloat(doc.miscExpenses) || 0,
    miscNote: String(doc.miscNote || ''),
  };
}

export async function saveLotExpenses(lotDateKey, { miscExpenses, miscNote }) {
  if (!lotDateKey) throw new Error('ไม่พบวันล็อต');
  await fsSetDoc(`lotExpenses/${lotDateKey}`, {
    lotDateKey,
    miscExpenses: Math.max(0, parseFloat(miscExpenses) || 0),
    miscNote: String(miscNote || '').trim(),
    updatedAt: new Date().toISOString(),
  });
}
