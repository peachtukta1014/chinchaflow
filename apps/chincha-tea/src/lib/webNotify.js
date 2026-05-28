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
      icon: '/chincha-logo.jpg',
      tag: tag || 'chincha-tea',
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
