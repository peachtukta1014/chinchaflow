import { fsPost } from './firestoreRest';
import { actorSnapshot } from './teaUserService.js';

export function staffSnapshot(member) {
  const actor = actorSnapshot(member);
  return {
    staffUid: actor.uid,
    staffName: actor.name,
    staffEmail: actor.email,
    staffRole: actor.role,
    userCode: actor.userCode,
    branchId: actor.branchId,
    actor,
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
