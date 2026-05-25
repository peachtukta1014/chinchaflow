import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { fsGetDoc } from './firestoreRest';

/** subscribe สมาชิกที่อนุมัติแล้ว */
export function subscribeTeaMember(onMember, onPending) {
  if (!auth) {
    onMember(null);
    return () => {};
  }
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      onPending?.(false);
      onMember(null);
      return;
    }
    try {
      const profile = await fsGetDoc(`users/${user.uid}`);
      if (!profile || profile.approved !== true) {
        onPending?.(true);
        onMember(null);
        return;
      }
      onPending?.(false);
      onMember({ uid: user.uid, email: user.email, ...profile });
    } catch {
      onPending?.(false);
      onMember(null);
    }
  });
}
