import { registerBadgeServiceWorker } from './registerBadgeWorker';

/**
 * ตัวเลขวงแดงบนไอคอนแอปที่ปักไว้ (เหมือนแอปอื่น) — รองรับ PWA บน iOS/Android
 * @param {number} count จำนวนออเดอร์ LINE ค้าง
 */
export async function setAppIconBadge(count) {
  if (typeof navigator === 'undefined') return;
  const n = Math.max(0, Number(count) || 0);

  try {
    if ('setAppBadge' in navigator) {
      if (n === 0) await navigator.clearAppBadge?.();
      else await navigator.setAppBadge(n);
    }
  } catch (e) {
    console.warn('setAppBadge', e);
  }

  try {
    await registerBadgeServiceWorker();
    const reg = await navigator.serviceWorker?.ready;
    reg?.active?.postMessage({ type: 'SET_BADGE', count: n });
  } catch {
    /* ไม่มี SW */
  }
}
