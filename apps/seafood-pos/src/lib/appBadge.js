/** อัปเดตตัวเลขบนไอคอน PWA (iOS/Android รองรับเฉพาะจำนวน ไม่ใช่ข้อความ) */
export function setAppIconBadge(count) {
  if (typeof navigator === 'undefined' || !('setAppBadge' in navigator)) return;
  const n = Math.max(0, Number(count) || 0);
  try {
    if (n === 0) navigator.clearAppBadge?.();
    else navigator.setAppBadge(n);
  } catch {
    /* บางเบราว์เซอร์ปิด badge */
  }
}
