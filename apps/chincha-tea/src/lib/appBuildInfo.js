/** ตั้งใน vite.config.js ตอน build */
export const APP_BUILD_ISO = typeof __APP_BUILD_ISO__ !== 'undefined' ? __APP_BUILD_ISO__ : '';

export function formatAppBuildLabel(iso = APP_BUILD_ISO) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function getAppBuildLabel() {
  const label = formatAppBuildLabel();
  return label ? `อัปเดต ${label}` : '';
}
