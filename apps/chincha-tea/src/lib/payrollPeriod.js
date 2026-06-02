import { shiftDateKey } from './constants';

/** รอบเงินเดือน 15 วัน: วันที่ 1–15 และ 16–สิ้นเดือน (ตามปฏิทิน กทม.) */

/**
 * @param {string} dateKey YYYY-MM-DD
 * @returns {{ id: string, startKey: string, endKey: string, half: 1|2, yearMonth: string }}
 */
export function getBiweeklyPeriodForDate(dateKey) {
  const [y, m, d] = dateKey.split('-').map((x) => parseInt(x, 10));
  const yearMonth = `${y}-${String(m).padStart(2, '0')}`;
  const day = d;
  if (day <= 15) {
    return {
      id: `${yearMonth}-H1`,
      startKey: `${yearMonth}-01`,
      endKey: `${yearMonth}-15`,
      half: 1,
      yearMonth,
    };
  }
  const lastDay = lastDayOfMonth(yearMonth);
  return {
    id: `${yearMonth}-H2`,
    startKey: `${yearMonth}-16`,
    endKey: lastDay,
    half: 2,
    yearMonth,
  };
}

function lastDayOfMonth(yearMonth) {
  const [y, m] = yearMonth.split('-').map((x) => parseInt(x, 10));
  const last = new Date(y, m, 0).getDate();
  return `${yearMonth}-${String(last).padStart(2, '0')}`;
}

/**
 * @param {{ id: string, startKey: string, endKey: string, half: 1|2, yearMonth: string }} period
 * @param {-1|1} delta
 */
export function shiftBiweeklyPeriod(period, delta) {
  if (delta === 0) return period;
  if (period.half === 1 && delta === -1) {
    const prevMonth = shiftYearMonth(period.yearMonth, -1);
    const endKey = lastDayOfMonth(prevMonth);
    return {
      id: `${prevMonth}-H2`,
      startKey: `${prevMonth}-16`,
      endKey,
      half: 2,
      yearMonth: prevMonth,
    };
  }
  if (period.half === 2 && delta === 1) {
    const nextMonth = shiftYearMonth(period.yearMonth, 1);
    return {
      id: `${nextMonth}-H1`,
      startKey: `${nextMonth}-01`,
      endKey: `${nextMonth}-15`,
      half: 1,
      yearMonth: nextMonth,
    };
  }
  if (period.half === 1 && delta === 1) {
    const endKey = lastDayOfMonth(period.yearMonth);
    return {
      id: `${period.yearMonth}-H2`,
      startKey: `${period.yearMonth}-16`,
      endKey,
      half: 2,
      yearMonth: period.yearMonth,
    };
  }
  // half === 2 && delta === -1
  return {
    id: `${period.yearMonth}-H1`,
    startKey: `${period.yearMonth}-01`,
    endKey: `${period.yearMonth}-15`,
    half: 1,
    yearMonth: period.yearMonth,
  };
}

function shiftYearMonth(yearMonth, months) {
  const [y, m] = yearMonth.split('-').map((x) => parseInt(x, 10));
  const d = new Date(Date.UTC(y, m - 1 + months, 1, 5, 0, 0));
  const ny = d.getUTCFullYear();
  const nm = d.getUTCMonth() + 1;
  return `${ny}-${String(nm).padStart(2, '0')}`;
}

/** @returns {string[]} date keys จาก start ถึง end รวมปลายทาง */
export function listDateKeysInRange(startKey, endKey) {
  const out = [];
  let cur = startKey;
  while (cur <= endKey) {
    out.push(cur);
    if (cur === endKey) break;
    cur = shiftDateKey(cur, 1);
  }
  return out;
}

/**
 * @param {{ startKey: string, endKey: string, half: 1|2 }} period
 * @param {'th'|'my'|'en'} [lang]
 */
export function formatBiweeklyPeriodLabel(period, lang = 'th') {
  const locale = lang === 'en' ? 'en-US' : lang === 'my' ? 'my-MM' : 'th-TH';
  const fmt = (dk) => {
    try {
      return new Date(`${dk}T12:00:00+07:00`).toLocaleDateString(locale, {
        day: 'numeric',
        month: 'short',
      });
    } catch {
      return dk;
    }
  };
  const range = `${fmt(period.startKey)} – ${fmt(period.endKey)}`;
  if (lang === 'en') {
    return period.half === 1 ? `Period 1–15 · ${range}` : `Period 16–end · ${range}`;
  }
  if (lang === 'my') {
    return period.half === 1 ? `၁–၁၅ · ${range}` : `၁၆–နောက်ဆုံး · ${range}`;
  }
  return period.half === 1 ? `รอบ 1–15 · ${range}` : `รอบ 16–สิ้นเดือน · ${range}`;
}

/** วันในสัปดาห์สั้น ๆ สำหรับป้ายในตาราง */
export function weekdayShort(dateKey, lang = 'th') {
  const locale = lang === 'en' ? 'en-US' : lang === 'my' ? 'my-MM' : 'th-TH';
  try {
    return new Date(`${dateKey}T12:00:00+07:00`).toLocaleDateString(locale, { weekday: 'narrow' });
  } catch {
    return '';
  }
}

export function dayOfMonth(dateKey) {
  return parseInt(dateKey.split('-')[2], 10);
}
