/** วันที่ตาม timezone กรุงเทพ (YYYY-MM-DD) */
export function dateKeyBangkok(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(date);
}

export function tomorrowDateKeyBangkok(date = new Date()) {
  const d = new Date(`${dateKeyBangkok(date)}T12:00:00+07:00`);
  d.setUTCDate(d.getUTCDate() + 1);
  return dateKeyBangkok(d);
}

if (typeof window !== 'undefined') {
  window.dateKeyBangkok = dateKeyBangkok;
  window.tomorrowDateKeyBangkok = tomorrowDateKeyBangkok;
}
