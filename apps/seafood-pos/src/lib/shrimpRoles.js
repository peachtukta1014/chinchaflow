import { OPERATIONAL_STAFF_EMAIL } from '../constants/config.js';

export { OPERATIONAL_STAFF_EMAIL };

export function normalizeShrimpEmail(email) {
  return (email || '').trim().toLowerCase();
}

export function isOperationalStaffEmail(email) {
  return normalizeShrimpEmail(email) === OPERATIONAL_STAFF_EMAIL;
}

/** ป้ายใน UI / หน้าสมาชิกแอป */
export function getShrimpRoleLabel(role, email) {
  if (role === 'admin') return 'แอดมิน';
  if (role === 'manager') return 'แมนเนเจอร์';
  if (role === 'staff' && isOperationalStaffEmail(email)) return 'สตาฟ (ลูกมือ)';
  if (role === 'staff') return 'สตาฟ';
  return '—';
}

export function isShrimpAdmin(member) {
  return member?.role === 'admin';
}
