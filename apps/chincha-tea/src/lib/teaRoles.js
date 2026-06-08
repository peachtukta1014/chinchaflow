/** ป้าย role สมาชิกแอปชา */
export function getTeaRoleLabel(role, t) {
  if (role === 'admin') return t('roleAdmin');
  if (role === 'staff') return t('roleStaff');
  return role || '';
}
