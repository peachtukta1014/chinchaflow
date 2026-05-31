/** น้ำหนักกุ้งที่บอทรับ (กก.) */
const MIN_WEIGHT_KG = 0.01;
const MAX_WEIGHT_KG = 20;

function isWeightUnit(unit) {
  const raw = String(unit || 'กก').replace(/\./g, '').trim();
  const lower = raw.toLowerCase();
  if (lower === 'บาท' || raw === '฿') return false;
  return true;
}

/**
 * @returns {'invalid'|'too_light'|'too_heavy'|null}
 */
function getOrderWeightIssue(qty, unit) {
  if (!isWeightUnit(unit)) return null;
  const n = parseFloat(qty);
  if (!Number.isFinite(n) || n <= 0) return 'invalid';
  if (n < MIN_WEIGHT_KG) return 'too_light';
  if (n > MAX_WEIGHT_KG) return 'too_heavy';
  return null;
}

function isValidOrderWeight(qty, unit) {
  return getOrderWeightIssue(qty, unit) === null;
}

module.exports = {
  MIN_WEIGHT_KG,
  MAX_WEIGHT_KG,
  isWeightUnit,
  isValidOrderWeight,
  getOrderWeightIssue,
};
