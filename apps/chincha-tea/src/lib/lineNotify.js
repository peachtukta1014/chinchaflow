import { auth } from '../firebase';

const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
const region = import.meta.env.VITE_FUNCTIONS_REGION || 'asia-southeast1';

export async function pushTeaLineSummary(dateKey) {
  if (!projectId) throw new Error('VITE_FIREBASE_PROJECT_ID ไม่ได้ตั้งค่า');
  const user = auth?.currentUser;
  if (!user) throw new Error('กรุณาเข้าสู่ระบบ');

  const idToken = await user.getIdToken();
  const url = `https://${region}-${projectId}.cloudfunctions.net/teaPushSummary`;
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ dateKey }),
  });

  const json = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (json.error === 'no_targets') {
      throw new Error('ยังไม่ได้ตั้ง LINE Group ID ในแอดมิน → LINE Bot');
    }
    throw new Error(json.error || `HTTP ${r.status}`);
  }
  return json;
}
