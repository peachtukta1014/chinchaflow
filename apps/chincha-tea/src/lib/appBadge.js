export function setAppIconBadge(count) {
  if (typeof navigator === 'undefined' || !('setAppBadge' in navigator)) return;
  const n = Math.max(0, Number(count) || 0);
  try {
    if (n === 0) navigator.clearAppBadge?.();
    else navigator.setAppBadge(n);
  } catch {
    /* unsupported */
  }
}
