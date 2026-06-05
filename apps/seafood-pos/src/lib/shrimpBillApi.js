/**
 * บิลกุ้งบน Cloud — วาดด้วย Satori (ไม่ใช้ html2canvas บนมือถือ)
 */
import { auth } from '../firebase';
import { saleToBillData } from './billDataFromSale';
import { resolveBillCustomer } from './resolveBillCustomer';
import { FIREBASE_PROJECT_ID } from './viteEnv.js';

const region = import.meta.env.VITE_FUNCTIONS_REGION || 'asia-southeast1';
const projectId = FIREBASE_PROJECT_ID;

function functionsBase(name) {
  if (!projectId) throw new Error('VITE_FIREBASE_PROJECT_ID ไม่ได้ตั้งค่า');
  return `https://${region}-${projectId}.cloudfunctions.net/${name}`;
}

async function authHeaders(json = true) {
  const base = json ? { 'Content-Type': 'application/json' } : {};
  const user = auth?.currentUser;
  if (!user) throw new Error('กรุณาเข้าสู่ระบบ');
  const token = await user.getIdToken();
  return { ...base, Authorization: `Bearer ${token}` };
}

/** payload สำหรับ Cloud จากบิลขาย + ลูกค้า (sync — ใช้เมื่อ resolve แล้ว) */
export function buildBillDataForCloud(bill, customer = {}) {
  return saleToBillData(bill, customer || {});
}

/** โหลดเบอร์/ที่อยู่จากรายชื่อลูกค้า แล้วคืน billData สำหรับ Cloud */
export async function buildBillDataForCloudResolved(bill, customer = {}) {
  const resolved = await resolveBillCustomer(bill, customer || {});
  return saleToBillData(bill, resolved);
}

/**
 * สร้างภาพบิลบน Cloud
 * @returns {Promise<{ blob: Blob, objectUrl: string }>}
 */
export async function fetchShrimpBillImage(bill, customer = {}, options = {}) {
  const billData = options.billData ?? await buildBillDataForCloudResolved(bill, customer);
  const r = await fetch(functionsBase('shrimpRenderBill'), {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ billData }),
  });
  if (!r.ok) {
    const json = await r.json().catch(() => ({}));
    throw new Error(json.error || `สร้างภาพบิลไม่สำเร็จ (${r.status})`);
  }
  const blob = await r.blob();
  return { blob, objectUrl: URL.createObjectURL(blob) };
}
