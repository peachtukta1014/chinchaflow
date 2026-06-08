/** ตัวอักษรย่อสำหรับ avatar เมื่อไม่มีรูป */
export function memberAvatarInitials(name, email = '') {
  const raw = String(name || email || '?').trim();
  if (!raw) return '?';
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return raw.slice(0, 2).toUpperCase();
}
