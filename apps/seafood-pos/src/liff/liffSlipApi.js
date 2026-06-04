import { FIREBASE_PROJECT_ID } from '../lib/viteEnv.js';

const ERROR_HINTS = {
  missing_id_token: 'เปิดจาก LINE อีกครั้ง',
  invalid_id_token: 'เซสชันหมดอายุ — ปิดแล้วเปิดใหม่',
  liff_not_configured: 'ระบบยังตั้งค่า LIFF ไม่ครบ — แจ้งร้าน',
  invalid_image: 'รูปไม่ถูกต้อง — เลือกใหม่ (ไม่เกิน 9 MB)',
};

function shrimpLiffSlipUrl() {
  const region = import.meta.env.VITE_FUNCTIONS_REGION || 'asia-southeast1';
  const projectId = FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error('VITE_FIREBASE_PROJECT_ID ไม่ได้ตั้งค่า');
  return `https://${region}-${projectId}.cloudfunctions.net/shrimpLiffSlip`;
}

/**
 * @param {{ idToken: string, imageBase64: string, billNo?: string }} payload
 */
export async function submitLiffSlip(payload) {
  const r = await fetch(shrimpLiffSlipUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) {
    const hint = ERROR_HINTS[json.error] || json.hint || json.error || `HTTP ${r.status}`;
    throw new Error(hint);
  }
  return json;
}
