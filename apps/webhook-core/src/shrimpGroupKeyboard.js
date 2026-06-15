/**
 * คีย์ลัดในกลุ่ม LINE ครอบครัว/พนักงาน — ไม่แสดงใน help ลูกค้า OA
 *
 * | คีย์ | ความหมาย |
 * |------|----------|
 * | 1    | สรุปออเดอร์วันนี้ (รายการ LINE รอส่ง) |
 * | 2    | help / คำสั่ง |
 * | 3    | สรุปยอดขายวันนี้ (จากบิล POS) |
 *
 * เลี่ยง 2 ในแชตตรง OA — ใช้สลับภาษาอังกฤษ
 */

function classifyShrimpGroupKeyboard(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  if (/^1$/.test(raw)) return 'today_orders';
  if (/^2$/.test(raw)) return 'help';
  if (/^3$/.test(raw)) return 'summary';
  return null;
}

function isShrimpGroupChat(groupId) {
  return Boolean(groupId);
}

module.exports = {
  classifyShrimpGroupKeyboard,
  isShrimpGroupChat,
};
