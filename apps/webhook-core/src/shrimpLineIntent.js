/**
 * จำแนกข้อความ LINE กุ้ง — ตอบเฉพาะคำสั่ง ไม่รบกวนแชททั่วไปในกลุ่ม
 */
const {
  parseOrderItems,
  normalizeOrderText,
  parseSimpleOrderLine,
  parseRiverPrawnPendingLine,
} = require('./parseLineOrder');
const { parseDeliveryDateFromText } = require('./parseDeliveryDate');
const { isShrimpSummaryCommand, SHRIMP_HELP_CMD } = require('./shrimpDailySummary');
const { isShrimpTodayOrdersCommand } = require('./shrimpTodayOrdersSummary');

const CANCEL_ORDER_CMD = /^(ยกเลิก|cancel|ยกเลิกออเดอร์|ยกเลิกorder|cancel\s*order)(\s|$)/i;

const UNIT_RE = /(กก\.?|กิโลกรัม|กิโล|โล|kg|บาท|฿)/i;
const ORDER_VERB_RE = /^(สั่ง|จอง|ใส่|บันทึก|ออเดอร์|order)\b/i;

function hasOrderBody(text) {
  const { textWithoutDate } = parseDeliveryDateFromText(text);
  const body = (textWithoutDate || text || '').trim();
  if (!body) return false;
  if (parseRiverPrawnPendingLine(body)) return true;
  if (parseOrderItems(body).length > 0) return true;
  const simple = parseSimpleOrderLine(body);
  if (simple?.kind === 'item' || simple?.kind === 'pending') return true;
  if (simple?.kind === 'size_only') return true;
  return false;
}

function isShrimpSessionContinuation(session) {
  if (!session) return false;
  if (session.pending) return true;
  if (session.profileCollect && session.orderDraft) return true;
  return false;
}

/** ข้อความที่ถือว่าเป็น "คำสั่งออเดอร์" (ไม่ใช่แค่มีตัวเลขในบทสนทนา) */
function isShrimpOrderCommand(text) {
  const raw = String(text || '').trim();
  if (!raw) return false;

  if (isShrimpSummaryCommand(raw) || isShrimpTodayOrdersCommand(raw) || SHRIMP_HELP_CMD.test(raw)) {
    return false;
  }

  const { dateKey, textWithoutDate } = parseDeliveryDateFromText(raw);
  if (dateKey && !hasOrderBody(raw)) return true;

  const body = (textWithoutDate || raw).trim();
  const t = normalizeOrderText(body);

  if (parseSimpleOrderLine(body)) return true;
  if (parseRiverPrawnPendingLine(body)) return true;

  if (!/กุ้ง/.test(t)) return false;
  if (!UNIT_RE.test(t)) return false;

  if (ORDER_VERB_RE.test(t)) return true;

  const items = parseOrderItems(raw);
  return items.length > 0;
}

function isShrimpCancelCommand(text) {
  return CANCEL_ORDER_CMD.test(String(text || '').trim());
}

function classifyShrimpLineMessage(text, session) {
  const raw = String(text || '').trim();
  if (!raw) return 'ignore';

  if (SHRIMP_HELP_CMD.test(raw)) return 'help';
  if (isShrimpCancelCommand(raw)) return 'cancel_order';

  if (isShrimpSessionContinuation(session)) return 'order';

  if (isShrimpTodayOrdersCommand(raw)) return 'today_orders';
  if (isShrimpSummaryCommand(raw)) return 'summary';
  if (isShrimpOrderCommand(raw)) return 'order';

  return 'ignore';
}

module.exports = {
  classifyShrimpLineMessage,
  isShrimpOrderCommand,
  isShrimpCancelCommand,
  hasOrderBody,
  isShrimpSessionContinuation,
};
