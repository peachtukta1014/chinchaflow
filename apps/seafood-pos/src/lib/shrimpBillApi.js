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
 * Cache ภาพบิล (blob) ต่อ saleId — TTL 5 นาที
 * เปิดบิลเดิมซ้ำในช่วงนั้น → ไม่ยิง Cloud Function ซ้ำ
 */
const _billBlobCache = new Map(); // saleId → { blob, cachedAt }
const BILL_BLOB_CACHE_TTL = 5 * 60 * 1000;

export function invalidateBillImageCache(saleId) {
  if (saleId) _billBlobCache.delete(saleId);
}

/**
 * สร้างภาพบิลบน Cloud (พร้อม in-memory blob cache ต่อ saleId)
 * @returns {Promise<{ blob: Blob, objectUrl: string }>}
 */
export async function fetchShrimpBillImage(bill, customer = {}, options = {}) {
  const cacheKey = bill?.id || bill?.saleId || null;
  const now = Date.now();

  if (cacheKey) {
    const hit = _billBlobCache.get(cacheKey);
    if (hit && now - hit.cachedAt < BILL_BLOB_CACHE_TTL) {
      return { blob: hit.blob, objectUrl: URL.createObjectURL(hit.blob) };
    }
  }

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

  if (cacheKey) {
    _billBlobCache.set(cacheKey, { blob, cachedAt: now });
  }

  return { blob, objectUrl: URL.createObjectURL(blob) };
}
