/** จัดรูปแบบวันที่/เวลาตามภาษาแอป */
export function localeTag(lang) {
  if (lang === 'en') return 'en-US';
  if (lang === 'my') return 'my-MM';
  return 'th-TH';
}

export function formatDateKeyLabel(dateKey, lang, options = {}) {
  try {
    return new Date(`${dateKey}T12:00:00+07:00`).toLocaleDateString(localeTag(lang), {
      weekday: options.weekday ?? 'short',
      day: 'numeric',
      month: 'short',
      year: options.year ? 'numeric' : undefined,
    });
  } catch {
    return dateKey;
  }
}

export function formatTimeLabel(iso, lang) {
  try {
    return new Date(iso).toLocaleTimeString(localeTag(lang), { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}
