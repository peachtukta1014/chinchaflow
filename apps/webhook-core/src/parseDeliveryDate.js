/**
 * แยกวันส่งจากข้อความ LINE (เวลาไทย Bangkok)
 * รองรับ 25/5/69, 25-5-2569, ออเดอร์?25/5/69, วันนี้, พรุ่งนี้ (ทุกตำแหน่งในข้อความ)
 */

function todayBKK() {
  return new Date(Date.now() + 7 * 3600000).toISOString().split('T')[0];
}

function tomorrowBKK() {
  const bkk = new Date(Date.now() + 7 * 3600000);
  bkk.setUTCDate(bkk.getUTCDate() + 1);
  return bkk.toISOString().split('T')[0];
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** พ.ศ. / ค.ศ. → ปี ค.ศ. สำหรับสร้าง dateKey */
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

function dateKeyFromParts(day, month, yearPart) {
  const d = parseInt(day, 10);
  const m = parseInt(month, 10);
  if (!Number.isFinite(d) || !Number.isFinite(m) || d < 1 || d > 31 || m < 1 || m > 12) {
    return null;
  }

  let y;
  if (yearPart == null || yearPart === '') {
    y = parseInt(todayBKK().slice(0, 4), 10);
  } else {
    y = toGregorianYear(yearPart);
  }
  if (!Number.isFinite(y)) return null;

  const dateKey = `${y}-${pad2(m)}-${pad2(d)}`;
  const probe = new Date(`${dateKey}T12:00:00+07:00`);
  if (Number.isNaN(probe.getTime())) return null;
  if (probe.getUTCDate() !== d || probe.getUTCMonth() + 1 !== m) return null;
  return dateKey;
}

const ORDER_WORD = '(?:ออร์?เดอร์|ออเดอร์|จอง|สั่ง|ส่ง)';
const DATE_INLINE_RE = new RegExp(
  `(?:${ORDER_WORD}|วันที่|ส่งวัน)?\\s*[?]?\\s*(\\d{1,2})\\s*[/.-]\\s*(\\d{1,2})(?:\\s*[/.-]\\s*(\\d{2,4}))?`,
  'i',
);

const ORDER_PREFIX_RE = new RegExp(`^${ORDER_WORD}\\s*[?]?\\s*`, 'i');

function stripOrderPrefix(text) {
  return String(text || '').replace(ORDER_PREFIX_RE, '').trim();
}

function stripRelativeDateTokens(text) {
  const beforeRel = new RegExp(`${ORDER_WORD}\\s*(?=พรุ่งนี้|tomorrow|วันนี้|today)`, 'gi');
  return String(text || '')
    .replace(beforeRel, ' ')
    .replace(/พรุ่งนี้|tomorrow/gi, ' ')
    .replace(/วันนี้|today/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @returns {{ dateKey: string|null, textWithoutDate: string }}
 */
function parseDeliveryDateFromText(text) {
  const raw = String(text || '').trim();
  if (!raw) return { dateKey: null, textWithoutDate: raw };

  const m = raw.match(DATE_INLINE_RE);
  if (m) {
    const dateKey = dateKeyFromParts(m[1], m[2], m[3]);
    if (dateKey) {
      const textWithoutDate = stripOrderPrefix(
        raw
          .replace(m[0], ' ')
          .replace(/\s+/g, ' ')
          .trim(),
      );
      return { dateKey, textWithoutDate };
    }
  }

  if (/(พรุ่งนี้|tomorrow)/i.test(raw)) {
    return {
      dateKey: tomorrowBKK(),
      textWithoutDate: stripOrderPrefix(stripRelativeDateTokens(raw)),
    };
  }
  if (/(วันนี้|today)/i.test(raw)) {
    return {
      dateKey: todayBKK(),
      textWithoutDate: stripOrderPrefix(stripRelativeDateTokens(raw)),
    };
  }

  return { dateKey: null, textWithoutDate: raw };
}

function formatDateThai(dateKey) {
  const [y, mo, d] = dateKey.split('-').map((x) => parseInt(x, 10));
  return `${d}/${mo}/${(y + 543) % 100}`;
}

module.exports = {
  todayBKK,
  tomorrowBKK,
  parseDeliveryDateFromText,
  formatDateThai,
  dateKeyFromParts,
};
