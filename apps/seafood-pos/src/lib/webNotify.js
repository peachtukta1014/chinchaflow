/** แจ้งเตือนบนมือถือ/คอม (เมื่ออนุญาต) — ใช้คู่กับ badge บนไอคอน */
export async function ensureNotifyPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    const r = await Notification.requestPermission();
    return r === 'granted';
  } catch {
    return false;
  }
}

export function showWebNotify(title, body, { tag, onClick } = {}) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, {
      body,
      icon: '/logo.jpg',
      tag: tag || 'seafood-pos',
      renotify: true,
    });
    n.onclick = () => {
      window.focus();
      onClick?.();
      n.close();
    };
  } catch (e) {
    console.warn('showWebNotify', e);
  }
}
