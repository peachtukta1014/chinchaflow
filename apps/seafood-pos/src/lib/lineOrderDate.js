import {
  dateKeyBangkok,
  formatDateThaiShort,
  formatViewDateLabel,
  shiftDateKey,
  tomorrowDateKeyBangkok,
} from './date.js';

/** 18:00 เมื่อวาน → 15:00 วันนี้ (ไม่ระบุวันส่ง) = ส่งวันนี้ · นอกช่วง = พรุ่งนี้ */
export const LINE_DEFAULT_TODAY_WINDOW = { startHour: 18, endHour: 15 };

/**
 * วันส่งเริ่มต้นเมื่อไม่พิมพ์วันที่ — ตรงกับบอท LINE
 * ช่วง 18:00 เมื่อวาน – 15:00 วันนี้ → วันนี้ · หลัง 15:00 → พรุ่งนี้
 */
export function defaultDeliveryDateKeyBangkok(now = new Date()) {
  const todayKey = dateKeyBangkok(now);
  const yesterdayKey = shiftDateKey(todayKey, -1);
  const pad = (n) => String(n).padStart(2, '0');
  const startMs = new Date(
    `${yesterdayKey}T${pad(LINE_DEFAULT_TODAY_WINDOW.startHour)}:00:00+07:00`,
  ).getTime();
  const endMs = new Date(
    `${todayKey}T${pad(LINE_DEFAULT_TODAY_WINDOW.endHour)}:00:00+07:00`,
  ).getTime();

  if (now.getTime() >= startMs && now.getTime() < endMs) return todayKey;
  return tomorrowDateKeyBangkok(now);
}

function parseCreatedAt(order) {
  const raw = order?.createdAt;
  if (!raw) return null;
  if (typeof raw === 'string') {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (raw instanceof Date) return raw;
  if (typeof raw === 'object' && raw.seconds != null) {
    return new Date(Number(raw.seconds) * 1000);
  }
  return null;
}

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

function parseDeliveryDateFromRaw(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;

  if (/(พรุ่งนี้|tomorrow)/i.test(text)) {
    return tomorrowDateKeyBangkok();
  }
  if (/(วันนี้|today)/i.test(text) && !/(พรุ่งนี้|tomorrow)/i.test(text)) {
    return dateKeyBangkok();
  }

  const m = text.match(/(\d{1,2})\s*[/.-]\s*(\d{1,2})(?:\s*[/.-]\s*(\d{2,4}))?/);
  if (m) return dateKeyFromThaiParts(m[1], m[2], m[3]);
  return null;
}

/**
 * วันส่งที่ตกลงตอนรับออเดอร์ — ใช้ deliveryDate ใน Firestore เป็นหลัก
 * (ไม่แปลง「พรุ่งนี้」ซ้ำวันรุ่งขึ้น — เมื่อถึงวันนั้นจะอยู่กลุ่มส่งวันนี้เอง)
 */
export function orderDeliveryDateKey(order) {
  const stored = String(order?.deliveryDate || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(stored)) return stored;
  const fromText = parseDeliveryDateFromRaw(order?.rawText);
  if (fromText) return fromText;
  const created = parseCreatedAt(order);
  if (created) return defaultDeliveryDateKeyBangkok(created);
  return defaultDeliveryDateKeyBangkok();
}

export function deliveryDateLabel(dateKey) {
  return formatViewDateLabel(dateKey) || formatDateThaiShort(dateKey) || dateKey;
}

/** @deprecated use orderDeliveryDateKey */
export const inferDeliveryDateKey = orderDeliveryDateKey;
