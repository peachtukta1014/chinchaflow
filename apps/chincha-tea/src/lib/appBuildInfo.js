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

/** แสดงใน header — v0.1.0 · abc1234 · อัปเดต 8 มิ.ย. 69 19:40 */
export function getAppBuildLabel() {
  const datePart = formatAppBuildLabel();
  const versionPart = APP_VERSION ? `v${APP_VERSION}` : '';
  const shaPart = APP_BUILD_SHA && APP_BUILD_SHA !== 'local' ? APP_BUILD_SHA : '';
  const patchPart = [versionPart, shaPart].filter(Boolean).join(' · ');
  if (patchPart && datePart) return `${patchPart} · อัปเดต ${datePart}`;
  if (patchPart) return patchPart;
  if (datePart) return `อัปเดต ${datePart}`;
  return '';
}
