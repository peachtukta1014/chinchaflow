/**
 * ชื่อลูกค้าในออเดอร์ LINE — ถ้าแชทตรงและผูก lineUserId กับรายชื่อแล้ว ใช้ชื่อร้านจากแอป
 * แทนชื่อที่พิมพ์มา (มักสะกดผิด เช่น เฟริส์ vs เฟิร์ส)
 */

function trimName(s) {
  return String(s || '').trim();
}

/**
 * @param {object} opts
 * @param {Array} opts.items — รายการจาก parseOrderItems
 * @param {string|null} opts.groupId — กลุ่ม LINE (หลายร้านในข้อความเดียว)
 * @param {string|null} opts.linkedCustomerName — ชื่อจาก customers.lineUserId
 * @returns {{ items: Array, useSyncedName: boolean }}
 */
function applySyncedCustomerNameToItems({ items = [], groupId, linkedCustomerName }) {
  const official = trimName(linkedCustomerName);
  if (groupId || !official) {
    return { items, useSyncedName: false };
  }

  const next = items.map((it) => ({
    ...it,
    customerName: official,
  }));
  return { items: next, useSyncedName: true };
}

/**
 * ชื่อหลักของออเดอร์ที่จะบันทึก (แชทตรง + ผูกแล้ว → ชื่อร้านในแอป)
 */
function resolveLineOrderCustomerName({ parsedName, groupId, linkedCustomerName }) {
  const official = trimName(linkedCustomerName);
  if (!groupId && official) return official;
  const parsed = trimName(parsedName);
  if (parsed) return parsed;
  return official || null;
}

module.exports = {
  applySyncedCustomerNameToItems,
  resolveLineOrderCustomerName,
};
