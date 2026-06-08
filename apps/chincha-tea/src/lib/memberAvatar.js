/**
 * ต่อ cache-bust โดยไม่ทิ้ง query ของ Firebase Storage (?alt=media&token=…)
 * ถ้าตัด token ออก รูปจะโหลดไม่ขึ้นและ fallback เป็นตัวอักษร
 */
export function appendPhotoCacheBust(photoUrl, bustValue) {
  if (!photoUrl) return '';
  if (!bustValue) return photoUrl;
  try {
    const u = new URL(photoUrl);
    u.searchParams.set('v', String(bustValue));
    return u.toString();
  } catch {
    const withoutV = photoUrl.replace(/([?&])v=[^&]*/g, '$1').replace(/[?&]$/, '');
    const sep = withoutV.includes('?') ? '&' : '?';
    return `${withoutV}${sep}v=${encodeURIComponent(bustValue)}`;
  }
}

/** URL รูปพร้อม cache-bust จาก photoUpdatedAt */
export function displayMemberPhotoUrl(photoUrl, photoUpdatedAt) {
  if (!photoUrl) return '';
  return appendPhotoCacheBust(photoUrl, photoUpdatedAt);
}

/** เอาแค่พารามิเตอร์ v ออก — เก็บ token Firebase ไว้ */
export function stripPhotoCacheBust(photoUrl) {
  if (!photoUrl) return '';
  try {
    const u = new URL(photoUrl);
    u.searchParams.delete('v');
    return u.toString();
  } catch {
    return photoUrl.replace(/([?&])v=[^&]*/g, '').replace(/[?&]$/, '');
  }
}

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
