import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { fsGetDoc } from './firestoreRest';

const MEMBER_CACHE_KEY = 'tea:memberProfile';

function readCachedMember(uid) {
  try {
    const raw = sessionStorage.getItem(MEMBER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.uid !== uid || parsed.approved !== true) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCachedMember(member) {
  try {
    sessionStorage.setItem(MEMBER_CACHE_KEY, JSON.stringify(member));
  } catch {
    /* quota / private mode */
  }
}

export function clearTeaMemberCache() {
  try {
    sessionStorage.removeItem(MEMBER_CACHE_KEY);
  } catch {
    /* ignore */
  }
}

/** subscribe สมาชิกที่อนุมัติแล้ว */
export function subscribeTeaMember(onMember, onPending) {
  if (!auth) {
    onMember(null);
    return () => {};
  }
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      clearTeaMemberCache();
      onPending?.(false);
      onMember(null);
      return;
    }

    const cached = readCachedMember(user.uid);
    if (cached) {
      onPending?.(false);
      onMember(cached);
    }

    try {
      const profile = await fsGetDoc(`users/${user.uid}`);
      if (!profile || profile.approved !== true) {
        clearTeaMemberCache();
        onPending?.(true);
        onMember(null);
        return;
      }
      const member = { uid: user.uid, email: user.email, ...profile };
      writeCachedMember(member);
      onPending?.(false);
      onMember(member);
    } catch {
      if (!cached) {
        onPending?.(false);
        onMember(null);
      }
    }
  });
}
