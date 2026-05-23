export function dateKeyBangkok(date = new Date()) {
  return new Date(date.getTime() + 7 * 3600000).toISOString().split('T')[0];
}

export function tomorrowDateKeyBangkok(date = new Date()) {
  return new Date(date.getTime() + 7 * 3600000 + 86400000).toISOString().split('T')[0];
}

if (typeof window !== 'undefined') {
  window.dateKeyBangkok = dateKeyBangkok;
  window.tomorrowDateKeyBangkok = tomorrowDateKeyBangkok;
}
