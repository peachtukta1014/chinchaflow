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

export function formatDateThaiShort(dateKey) {
  const [y, mo, d] = dateKey.split('-').map((x) => parseInt(x, 10));
  if (!y || !mo || !d) return dateKey;
  return `${d}/${mo}/${(y + 543) % 100}`;
}

/** ป้ายวันสำหรับตัวเลื่อนวัน (วันนี้ / เมื่อวาน / พรุ่งนี้ / วันที่สั้น) */
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
