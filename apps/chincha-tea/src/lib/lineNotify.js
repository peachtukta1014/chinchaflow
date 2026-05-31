import { getFirebaseIdToken } from '../firebase';
import { FIREBASE_PROJECT_ID, viteEnv } from './viteEnv.js';

const projectId = FIREBASE_PROJECT_ID;
const region = viteEnv('VITE_FUNCTIONS_REGION') || 'asia-southeast1';

export async function pushTeaLineSummary(dateKey) {
  if (!projectId) throw new Error('VITE_FIREBASE_PROJECT_ID ไม่ได้ตั้งค่า');

  const idToken = await getFirebaseIdToken();
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
    if (json.error === 'admin only') {
      throw new Error('เฉพาะแอดมินเท่านั้นที่ส่งสรุปได้');
    }
    if (json.error === 'unauthorized') {
      throw new Error('กรุณาออกจากระบบแล้วเข้าใหม่');
    }
    throw new Error(json.error || json.hint || `HTTP ${r.status}`);
  }
  return json;
}
