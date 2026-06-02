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

/** ลูกมือช่วยส่งของ (โก๊ะ) — คนเดียวที่ใช้ role staff ใน Firestore */
export const OPERATIONAL_STAFF_EMAIL = 'techitudom2000@gmail.com';
