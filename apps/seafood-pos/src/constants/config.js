/** อีเมลแอดมินหลัก — สมัคร/ล็อกอินครั้งแรกได้ admin + อนุมัติทันที (ตรง firestore.rules) */
export const ADMIN_EMAILS = [
  'gmc-peach@chincha.pos',
  'peachtukta1014@gmail.com',
];

/** @deprecated ใช้ isBootstrapAdminEmail() แทน */
export const ADMIN_EMAIL = ADMIN_EMAILS[0];

export function isBootstrapAdminEmail(email) {
  const em = (email || '').trim().toLowerCase();
  return ADMIN_EMAILS.some((e) => e.toLowerCase() === em);
}

export const SESSION_KEY = 'koseafood-session';
export const SESSION_DAYS = 30;

/** อีเมลลูกมือหลัก (โก๊ะ) — ใช้แสดงป้าย「สตาฟ (ลูกมือ)」ใน UI */
export const OPERATIONAL_STAFF_EMAIL = 'techitudom2000@gmail.com';

/** role ตอนสมัครครั้งแรก — แอดมิน bootstrap เท่านั้นที่ได้ admin ทันที */
export function getShrimpSignupRole(email) {
  return isBootstrapAdminEmail(email) ? 'admin' : 'staff';
}
