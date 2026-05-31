import { dateKeyBangkok } from './date.js';

/** วันที่รับเข้า (ล็อต = 1 วัน) — รองรับข้อมูลเก่าที่ไม่มี receiveDateKey */
export function receiveDateKeyOf(batch) {
  if (batch?.receiveDateKey) return batch.receiveDateKey;
  if (!batch?.purchaseDate) return 'unknown';
  const d = typeof batch.purchaseDate?.toDate === 'function'
    ? batch.purchaseDate.toDate()
    : new Date(batch.purchaseDate);
  if (Number.isNaN(d.getTime())) return 'unknown';
  return dateKeyBangkok(d);
}

export function formatReceiveDayLabel(dateKey) {
  if (!dateKey || dateKey === 'unknown') return '—';
  const d = new Date(`${dateKey}T12:00:00+07:00`);
  return d.toLocaleDateString('th-TH', {
    timeZone: 'Asia/Bangkok',
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  });
}

/** จัดกลุ่มรายการรับเข้าตามวัน — วันล่าสุดอยู่บน */
export function groupBatchesByReceiveDay(batches = []) {
  const map = new Map();
  for (const b of batches) {
    const key = receiveDateKeyOf(b);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(b);
  }
  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dateKey, items]) => {
      const sorted = [...items].sort((x, y) => {
        const tx = new Date(x.purchaseDate || 0).getTime();
        const ty = new Date(y.purchaseDate || 0).getTime();
        return tx - ty;
      });
      const remainingLive = sorted.reduce(
        (s, i) => s + (parseFloat(i.remainingLiveKg ?? i.liveKg) || 0),
        0,
      );
      const remainingDead = sorted.reduce(
        (s, i) => s + (parseFloat(i.remainingDeadKg ?? i.deadKg) || 0),
        0,
      );
      const totalCost = sorted.reduce((s, i) => s + (parseFloat(i.totalCost) || 0), 0);
      return {
        dateKey,
        label: formatReceiveDayLabel(dateKey),
        items: sorted,
        remainingLive,
        remainingDead,
        totalCost,
        itemCount: sorted.length,
      };
    });
}

/** ลำดับตัดสต๊อก FIFO: วันเก่าก่อน → รายการเก่าก่อนในวัน */
export function sortBatchesFifoOrder(batches = []) {
  return [...batches].sort((a, b) => {
    const da = receiveDateKeyOf(a);
    const db = receiveDateKeyOf(b);
    if (da !== db) return da.localeCompare(db);
    return new Date(a.purchaseDate || 0).getTime() - new Date(b.purchaseDate || 0).getTime();
  });
}

export function countReceivesOnDate(batches, dateKey) {
  return batches.filter((b) => receiveDateKeyOf(b) === dateKey).length;
}

/** วันรับล่าสุดในรายการล็อต (lotDays เรียงใหม่→เก่า) */
export function newestLotDateKey(lotDays = []) {
  return lotDays[0]?.dateKey ?? null;
}

/**
 * ล็อตเริ่มต้น = รถ/วันรับล่าสุดที่ยังไม่ปิด (ใช้ทั้งแอดมินและรายจ่าย)
 */
export function pickDefaultLotDateKey(lotDays = [], closedLotKeys = new Set()) {
  if (!lotDays.length) return dateKeyBangkok();
  const open = lotDays.find((d) => !closedLotKeys.has(d.dateKey));
  return open?.dateKey ?? lotDays[0].dateKey;
}

/** ป้ายใน dropdown ล็อต */
export function formatLotDayOptionLabel(day, { newestKey, closedLotKeys = new Set() } = {}) {
  const parts = [day.label];
  if (newestKey && day.dateKey === newestKey) parts.push('ล็อตล่าสุด');
  if (closedLotKeys.has(day.dateKey)) parts.push('ปิดแล้ว');
  return parts.join(' · ');
}
