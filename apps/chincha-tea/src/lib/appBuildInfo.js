/** ตั้งใน vite.config.js ตอน build */
export const APP_BUILD_ISO = typeof __APP_BUILD_ISO__ !== 'undefined' ? __APP_BUILD_ISO__ : '';
export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '';
export const APP_BUILD_SHA = typeof __APP_BUILD_SHA__ !== 'undefined' ? __APP_BUILD_SHA__ : '';

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

function teaDateCode(iso = APP_BUILD_ISO) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(d);
  const day = parts.find((p) => p.type === 'day')?.value ?? '00';
  const month = parts.find((p) => p.type === 'month')?.value ?? '00';
  const year = parseInt(parts.find((p) => p.type === 'year')?.value ?? '0', 10);
  const buddhistYY = String(year + 543).slice(-2);
  return `TEA-${day}${month}${buddhistYY}`;
}

function formatAppBuildDate(iso = APP_BUILD_ISO) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  });
}

/** แสดงใน header — TEA-190669 · อัปเดต 19 มิ.ย. 69 */
export function getAppBuildLabel() {
  const code = teaDateCode();
  const datePart = formatAppBuildDate();
  if (code && datePart) return `${code} · อัปเดต ${datePart}`;
  if (code) return code;
  if (datePart) return `อัปเดต ${datePart}`;
  return '';
}
