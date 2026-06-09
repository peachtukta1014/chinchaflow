/** รีเฟรชแอป PWA — ล้าง cache ที่มี แล้วโหลดเวอร์ชันล่าสุดจากเซิร์ฟเวอร์ */
export async function hardReloadApp() {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch (e) {
    console.warn('hardReloadApp', e);
  }
  window.scrollTo(0, 0);
  const url = new URL(window.location.href);
  url.searchParams.set('_', String(Date.now()));
  window.location.replace(url.toString());
}
