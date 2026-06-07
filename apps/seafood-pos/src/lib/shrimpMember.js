/** สร้าง object สมาชิกที่ใช้ทั่วแอปจาก shrimp_users doc */
export function buildShrimpMember(uid, profile = {}, authEmail = '') {
  const name = String(profile.name || '').trim() || 'สมาชิก';
  const email = String(authEmail || profile.email || '').trim().toLowerCase();
  return {
    uid,
    name,
    displayName: name,
    email,
    role: profile.role || 'staff',
    phone: String(profile.phone || '').trim(),
    photoUrl: String(profile.photoUrl || '').trim(),
  };
}
