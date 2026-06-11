import { fsPost } from './firestoreRest';

export function staffSnapshot(member) {
  return {
    staffUid: member?.uid || '',
    staffName: member?.name || member?.email || 'ชินชา',
    staffEmail: member?.email || '',
    staffRole: member?.role || 'staff',
  };
}

export async function writeHistoryLog({ action, collection, docId = '', dateKey = '', member, summary = {}, refPath = '' }) {
  if (!action) return;
  try {
    await fsPost('historyLogs', {
      action,
      collection,
      docId,
      refPath,
      dateKey,
      ...staffSnapshot(member),
      summary,
      createdAt: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('writeHistoryLog failed', e);
  }
}
