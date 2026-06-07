import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { isBootstrapAdminEmail } from '../constants';
import { fsGetDoc, fsPatch } from './firestoreRest';
import { buildShrimpMember } from './shrimpMember';

/**
 * Restore an approved shrimp_users session from Firebase Auth.
 * Does not sign out — LoginScreen owns the interactive login/register flow.
 */
export function subscribeShrimpMember(onMember) {
  if (!auth) {
    onMember(null);
    return () => {};
  }
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      onMember(null);
      return;
    }
    try {
      let profile = await fsGetDoc(`shrimp_users/${user.uid}`);
      if (!profile) return;

      const em = (user.email || profile.email || '').trim().toLowerCase();
      if (profile.approved !== true && isBootstrapAdminEmail(em)) {
        await fsPatch(`shrimp_users/${user.uid}`, { role: 'admin', approved: true });
        profile = await fsGetDoc(`shrimp_users/${user.uid}`);
      }

      if (profile?.approved === true) {
        onMember(buildShrimpMember(user.uid, profile, em));
      }
    } catch {
      /* transient — LoginScreen or a later auth event may recover */
    }
  });
}
