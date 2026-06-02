import { OPERATIONAL_STAFF_EMAIL } from '../constants/config.js';

export { OPERATIONAL_STAFF_EMAIL };

export function normalizeShrimpEmail(email) {
  return (email || '').trim().toLowerCase();
}

export function isOperationalStaffEmail(email) {
  return normalizeShrimpEmail(email) === OPERATIONAL_STAFF_EMAIL;
}

/** แสดงใน UI — ตาม role จริงใน Firestore */
export function getShrimpRoleLabel(role, email) {
  if (role === 'admin') return 'แอดมิน';
  if (role === 'manager') return 'แมนเนเจอร์';
  if (role === 'staff' && isOperationalStaffEmail(email)) return 'สตาฟ (ลูกมือ)';
  if (role === 'staff') return 'แมนเนเจอร์'; // legacy ก่อน migrate
  return '—';
}

export function shouldMigrateStaffToManager(role, email) {
  return role === 'staff' && !isOperationalStaffEmail(email);
}

export function isShrimpAdmin(member) {
  return member?.role === 'admin';
}

export function isShrimpManager(member) {
  return member?.role === 'manager'
    || shouldMigrateStaffToManager(member?.role, member?.email);
}

export function isShrimpOperationalStaff(member) {
  return member?.role === 'staff' && isOperationalStaffEmail(member?.email);
}

/** @returns {'admin'|'manager'|'operational'} */
export function getShrimpAccessTier(member) {
  if (isShrimpAdmin(member)) return 'admin';
  if (isShrimpOperationalStaff(member)) return 'operational';
  if (isShrimpManager(member)) return 'manager';
  return 'manager';
}
