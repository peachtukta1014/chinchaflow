/** Service worker เฉพาะอัปเดตตัวเลขบนไอคอนแอปที่ปักไว้ (PWA badge) */
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'SET_BADGE') return;
  const n = Math.max(0, Number(data.count) || 0);
  try {
    if (n === 0 && self.clearAppBadge) self.clearAppBadge();
    else if (n > 0 && self.setAppBadge) self.setAppBadge(n);
  } catch {
    /* เบราว์เซอร์ไม่รองรับ */
  }
});
