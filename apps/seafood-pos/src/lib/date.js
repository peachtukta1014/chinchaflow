/** วันที่ตาม timezone กรุงเทพ (YYYY-MM-DD) */
export function dateKeyBangkok(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(date);
}

export function tomorrowDateKeyBangkok(date = new Date()) {
  const d = new Date(`${dateKeyBangkok(date)}T12:00:00+07:00`);
  d.setUTCDate(d.getUTCDate() + 1);
  return dateKeyBangkok(d);
}

/** เลื่อนวัน YYYY-MM-DD ตาม timezone กรุงเทพ */
export function shiftDateKey(dateKey, deltaDays) {
  const d = new Date(`${dateKey}T12:00:00+07:00`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return dateKeyBangkok(d);
}

/** วันที่บิล/เอกสาร — ใช้ dateKey ก่อน แล้วค่อยแปลง createdAt เป็นเวลาไทย */
export function saleDateKeyFromBill(bill) {
  const dk = bill?.dateKey;
  if (dk && /^\d{4}-\d{2}-\d{2}$/.test(String(dk))) return dk;
  const raw = bill?.createdAt || bill?.timestamp || '';
  if (!raw) return '';
  const d = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  return dateKeyBangkok(d);
}

export function formatDateThaiShort(dateKey) {
  const [y, mo, d] = dateKey.split('-').map((x) => parseInt(x, 10));
  if (!y || !mo || !d) return dateKey;
  return `${d}/${mo}/${(y + 543) % 100}`;
}

/** ป้ายวันสำหรับตัวเลื่อนวัน (วันนี้ / เมื่อวาน / พรุ่งนี้ / วันที่สั้น) */
/** รายการ dateKey จาก start ถึง end (รวมปลายทาง) */
export function dateKeysBetween(startKey, endKey, maxDays = 90) {
  if (!startKey || !endKey || startKey > endKey) return [];
  const keys = [];
  let k = startKey;
  while (k <= endKey && keys.length < maxDays) {
    keys.push(k);
    k = shiftDateKey(k, 1);
  }
  return keys;
}

export function formatViewDateLabel(dateKey) {
  const today = dateKeyBangkok();
  if (dateKey === today) return 'วันนี้';
  if (dateKey === shiftDateKey(today, -1)) return 'เมื่อวาน';
  if (dateKey === shiftDateKey(today, 1)) return 'พรุ่งนี้';
  return formatDateThaiShort(dateKey);
}

if (typeof window !== 'undefined') {
  window.dateKeyBangkok = dateKeyBangkok;
  window.tomorrowDateKeyBangkok = tomorrowDateKeyBangkok;
}
