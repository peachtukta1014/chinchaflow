import { fsPost } from './firestoreRest';
import { teaWriteSnapshot } from './teaBackendService';

export function staffSnapshot(member) {
  return teaWriteSnapshot(member);
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
      schemaVersion: 2,
      createdAt: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('writeHistoryLog failed', e);
  }
}
