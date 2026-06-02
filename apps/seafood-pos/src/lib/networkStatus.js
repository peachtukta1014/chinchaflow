/** Browser online/offline detection for POS offline queue. */

export function isNetworkOnline() {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
}

export function subscribeNetworkStatus(onChange) {
  if (typeof window === 'undefined') return () => {};
  const handler = () => onChange(isNetworkOnline());
  window.addEventListener('online', handler);
  window.addEventListener('offline', handler);
  return () => {
    window.removeEventListener('online', handler);
    window.removeEventListener('offline', handler);
  };
}

export function isNetworkError(err) {
  const msg = String(err?.message || err?.code || err || '');
  return /timeout|Failed to fetch|NetworkError|network-request-failed|offline|ERR_INTERNET_DISCONNECTED/i.test(msg);
}
