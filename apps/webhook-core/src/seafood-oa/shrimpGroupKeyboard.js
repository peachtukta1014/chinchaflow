/**
 * คีย์ลัดในกลุ่ม LINE ครอบครัว/พนักงาน — ไม่แสดงใน help ลูกค้า OA
 *
 * | คีย์ | ความหมาย |
 * |------|----------|
 * | 1    | สรุปออเดอร์วันนี้ (รายการ LINE รอส่ง) |
 * | 3    | สรุปยอดขายวันนี้ (จากบิล POS) |
 *
 * กลุ่มไม่ตอบ help — เลี่ยง 2 (ใช้สลับภาษาอังกฤษในแชตตรง OA)
 */

function classifyShrimpGroupKeyboard(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  if (/^1$/.test(raw)) return 'today_orders';
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
