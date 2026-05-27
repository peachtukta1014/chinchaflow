import { dateKeyBangkok, formatDateThaiShort, formatViewDateLabel, tomorrowDateKeyBangkok } from './date.js';

function toGregorianYear(y) {
  const n = parseInt(y, 10);
  if (!Number.isFinite(n)) return null;
  if (n >= 2400) return n - 543;
  if (n >= 2000 && n < 2400) return n;
  if (n >= 100) return n - 543;
  if (n >= 50) return 2500 + n - 543;
  if (n >= 0 && n < 30) return 2000 + n;
  return 2500 + n - 543;
}

function dateKeyFromThaiParts(day, month, yearPart) {
  const d = parseInt(day, 10);
  const m = parseInt(month, 10);
  if (!Number.isFinite(d) || !Number.isFinite(m) || d < 1 || d > 31 || m < 1 || m > 12) {
    return null;
  }
  let y;
  if (yearPart == null || yearPart === '') {
    y = parseInt(dateKeyBangkok().slice(0, 4), 10);
  } else {
    y = toGregorianYear(yearPart);
  }
  if (!Number.isFinite(y)) return null;
  const pad = (n) => String(n).padStart(2, '0');
  const dateKey = `${y}-${pad(m)}-${pad(d)}`;
  const probe = new Date(`${dateKey}T12:00:00+07:00`);
  if (Number.isNaN(probe.getTime())) return null;
  if (probe.getUTCDate() !== d || probe.getUTCMonth() + 1 !== m) return null;
  return dateKey;
}

/**
 * อ่านวันส่งจาก rawText อีกครั้ง (กันกรณี webhook บันทึก deliveryDate ผิด)
 */
export function inferDeliveryDateKey(order) {
  const raw = String(order?.rawText || '').trim();
  const stored = order?.deliveryDate || '';

  if (/(พรุ่งนี้|tomorrow)/i.test(raw)) {
    return tomorrowDateKeyBangkok();
  }
  if (/(วันนี้|today)/i.test(raw) && !/(พรุ่งนี้|tomorrow)/i.test(raw)) {
    return dateKeyBangkok();
  }

  const m = raw.match(/(\d{1,2})\s*[/.-]\s*(\d{1,2})(?:\s*[/.-]\s*(\d{2,4}))?/);
  if (m) {
    const parsed = dateKeyFromThaiParts(m[1], m[2], m[3]);
    if (parsed) return parsed;
  }

  if (stored && /^\d{4}-\d{2}-\d{2}$/.test(stored)) return stored;
  return dateKeyBangkok();
}

export function deliveryDateLabel(dateKey) {
  return formatViewDateLabel(dateKey) || formatDateThaiShort(dateKey) || dateKey;
}
