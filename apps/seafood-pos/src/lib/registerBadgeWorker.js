let registerPromise = null;

/** ลงทะเบียน SW สำหรับ badge บนไอคอน (Android / iOS 16.4+ ที่ปักแอปไว้) */
export function registerBadgeServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return Promise.resolve(null);
  }
  if (!registerPromise) {
    registerPromise = navigator.serviceWorker
      .register('/sw-badge.js', { scope: '/' })
      .catch((e) => {
        console.warn('badge SW register', e);
        registerPromise = null;
        return null;
      });
  }
  return registerPromise;
}
