/** ค่าเริ่มต้น: 18:00 เมื่อวาน → 15:00 วันนี้ = ส่งวันนี้ */
const DEFAULT_DELIVERY_WINDOW = { startHour: 18, endHour: 15 };

const CACHE_MS = 60_000;
let cached = null;
let cachedAt = 0;

function clampHour(n, fallback) {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0 || v > 23) return fallback;
  return Math.floor(v);
}

/**
 * อ่านช่วงเวลา「ไม่ระบุวันส่ง」จาก config/shrimpLine
 * @param {object|null|undefined} config
 */
function deliveryWindowFromConfig(config) {
  if (!config || typeof config !== 'object') return { ...DEFAULT_DELIVERY_WINDOW };
  return {
    startHour: clampHour(config.lineDefaultStartHour, DEFAULT_DELIVERY_WINDOW.startHour),
    endHour: clampHour(config.lineDefaultEndHour, DEFAULT_DELIVERY_WINDOW.endHour),
  };
}

async function getShrimpLineConfig(db) {
  const snap = await db.collection('config').doc('shrimpLine').get();
  return snap.exists ? snap.data() : {};
}

async function getShrimpLineDeliveryWindow(db) {
  const now = Date.now();
  if (cached && now - cachedAt < CACHE_MS) return cached;
  const config = await getShrimpLineConfig(db);
  cached = deliveryWindowFromConfig(config);
  cachedAt = now;
  return cached;
}

function clearShrimpLineConfigCache() {
  cached = null;
  cachedAt = 0;
}

module.exports = {
  DEFAULT_DELIVERY_WINDOW,
  deliveryWindowFromConfig,
  getShrimpLineConfig,
  getShrimpLineDeliveryWindow,
  clearShrimpLineConfigCache,
};
