import { FIREBASE_PROJECT_ID } from '../lib/viteEnv.js';

const ERROR_HINTS = {
  missing_id_token: 'เปิดฟอร์มจาก LINE อีกครั้ง',
  invalid_id_token: 'เซสชันหมดอายุ — ปิดแล้วเปิดใหม่จากแชท OA',
  liff_not_configured: 'ระบบยังตั้งค่า LIFF ไม่ครบ — แจ้งร้าน',
  empty_order: 'เลือกกุ้งและน้ำหนักอย่างน้อยหนึ่งรายการ',
  invalid_weight: 'น้ำหนักไม่ถูกต้อง (0.01–20 กก.)',
  customer_required: 'เลือกชื่อลูกค้าในรายชื่อ',
};

function shrimpLiffUrl() {
  const region = import.meta.env.VITE_FUNCTIONS_REGION || 'asia-southeast1';
  const projectId = FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error('VITE_FIREBASE_PROJECT_ID ไม่ได้ตั้งค่า');
  return `https://${region}-${projectId}.cloudfunctions.net/shrimpLiffOrder`;
}

async function postLiff(body) {
  const r = await fetch(shrimpLiffUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) {
    const hint = ERROR_HINTS[json.error] || json.hint || json.error || `HTTP ${r.status}`;
    throw new Error(hint);
  }
  return json;
}

/** @param {string} idToken */
export function fetchLiffContext(idToken) {
  return postLiff({ action: 'context', idToken });
}

export function submitLiffOrder({
  idToken,
  river,
  deliveryDate,
  customerId,
  customerName,
  registerNew,
  phone,
  notes,
  linkUid,
}) {
  return postLiff({
    action: 'submit',
    idToken,
    river,
    deliveryDate,
    customerId: customerId || undefined,
    customerName: customerName || undefined,
    registerNew: registerNew === true,
    phone,
    notes,
    linkUid,
  });
}
