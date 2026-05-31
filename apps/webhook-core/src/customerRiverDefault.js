const {
  findCustomerByLineUserId,
  findCustomerByName,
} = require('./shrimpLineCustomerProfile');
const { sizeWordToProduct } = require('./parseLineOrder');

const SIZE_ALIASES = {
  small: 'เล็ก',
  medium: 'กลาง',
  large: 'ใหญ่',
  s: 'เล็ก',
  m: 'กลาง',
  l: 'ใหญ่',
  c: 'เล็ก',
  b: 'กลาง',
  a: 'ใหญ่',
};

/** @returns {string|null} ชื่อสินค้าในออเดอร์ เช่น กุ้งเล็ก */
function riverDefaultToProduct(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s || s === 'ask' || s === 'ถาม' || s === 'prompt') return null;
  const word = SIZE_ALIASES[s] || s;
  return sizeWordToProduct(word);
}

/**
 * ลูกค้าประจำที่ตั้ง defaultRiverSize — ไม่ถามขนาดซ้ำ
 * @returns {Promise<string|null>}
 */
async function resolveRiverDefaultProduct(db, { lineUserId, customerName, groupId }) {
  if (groupId) return null;

  let customer = null;
  if (lineUserId) {
    customer = await findCustomerByLineUserId(db, lineUserId);
  }
  if (!customer && customerName) {
    customer = await findCustomerByName(db, customerName);
  }
  if (!customer) return null;

  return riverDefaultToProduct(customer.defaultRiverSize);
}

module.exports = {
  riverDefaultToProduct,
  resolveRiverDefaultProduct,
};
