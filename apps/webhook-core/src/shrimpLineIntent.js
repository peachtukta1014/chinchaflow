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
const { translateOrderTextToThai } = require('./translateOrderText');
const { hasMyanmarScript } = require('./orderMessageLang');
const { isShrimpSummaryCommand, SHRIMP_HELP_CMD } = require('./shrimpDailySummary');

/** หลังข้อความช่วยเหลือภาษาไทย — ลูกค้าขอเมนูภาษาอังกฤษ */
const SHRIMP_HELP_EN_CMD = /^(2|en|english|eng)(\s|$)/i;
const { isShrimpTodayOrdersCommand } = require('./shrimpTodayOrdersSummary');
const { isLinkCustomerCommand } = require('./shrimpLineCustomerLink');
const { classifyShrimpGroupKeyboard, isShrimpGroupChat } = require('./shrimpGroupKeyboard');

const CANCEL_ORDER_CMD = /^(ยกเลิก|cancel|ยกเลิกออเดอร์|ยกเลิกorder|cancel\s*order|ပယ်ဖျက်)(\s|$)/i;

/** เปิดฟอร์ม LIFF — ใช้ในแชต OA 1:1 เท่านั้น */
const LIFF_OPEN_CMD = /^(ฟอร์ม|form|liff|เปิดฟอร์ม|เมนูสั่ง|order\s*form|open\s*form)(\s|$)/i;

const UNIT_RE = /(กก\.?|กิโลกรัม|กิโล|โล|kg|บาท|฿)/i;
const ORDER_VERB_RE = /^(สั่ง|จอง|ใส่|บันทึก|ออเดอร์|order)\b/i;

function hasOrderBody(text) {
  const { textWithoutDate } = parseDeliveryDateFromText(text);
  const body = (textWithoutDate || text || '').trim();
  if (!body) return false;
  if (parseRiverPrawnPendingLine(body)) return true;
  if (parseOrderItems(body).length > 0) return true;
  const simple = parseSimpleOrderLine(body);
  if (simple?.kind === 'invalid_weight') return true;
  if (simple?.kind === 'item' || simple?.kind === 'pending') return true;
  if (simple?.kind === 'size_only') return true;
  return false;
}

function isShrimpSessionContinuation(session) {
  if (!session) return false;
  if (session.pending) return true;
  if (session.profileCollect && session.orderDraft) return true;
  if (session.customerLink?.step) return true;
  return false;
}

/** ข้อความที่ถือว่าเป็น "คำสั่งออเดอร์" (ไม่ใช่แค่มีตัวเลขในบทสนทนา) */
function isShrimpOrderCommand(text) {
  const raw = String(text || '').trim();
  if (!raw) return false;

  if (isShrimpSummaryCommand(raw) || isShrimpTodayOrdersCommand(raw) || SHRIMP_HELP_CMD.test(raw)) {
    return false;
  }

  const translated = translateOrderTextToThai(raw);
  const candidates = translated !== raw ? [raw, translated] : [raw];

  for (const candidate of candidates) {
    const { dateKey, textWithoutDate } = parseDeliveryDateFromText(candidate);
    if (dateKey && !hasOrderBody(candidate)) return true;

    const body = (textWithoutDate || candidate).trim();
    const t = normalizeOrderText(body);

    if (parseSimpleOrderLine(body)) return true;
    const river = parseRiverPrawnPendingLine(body);
    if (river) return true;

    if (hasMyanmarScript(candidate) && UNIT_RE.test(body)) return true;

    if (!/กุ้ง/.test(t) && !UNIT_RE.test(body)) continue;
    if (!/กุ้ง/.test(t) && !UNIT_RE.test(t)) continue;

    if (ORDER_VERB_RE.test(t)) return true;

    const items = parseOrderItems(candidate);
    if (items.length > 0) return true;
  }
  return false;
}

function isShrimpCancelCommand(text) {
  return CANCEL_ORDER_CMD.test(String(text || '').trim());
}

function isShrimpLiffOpenCommand(text) {
  return LIFF_OPEN_CMD.test(String(text || '').trim());
}

/** ในกลุ่มครอบครัว/พนักงาน — ตอบคำสั่งสรุป/ออเดอร์/help (ไม่รบกวนแชททั่วไป) */
const SHRIMP_GROUP_ALLOWED_INTENTS = new Set(['order', 'summary', 'today_orders', 'help']);

function applyShrimpGroupOrdersOnlyFilter(intent, groupId) {
  if (!isShrimpGroupChat(groupId)) return intent;
  return SHRIMP_GROUP_ALLOWED_INTENTS.has(intent) ? intent : 'ignore';
}

function classifyShrimpLineMessage(text, session, { groupId = null } = {}) {
  const raw = String(text || '').trim();
  if (!raw) return 'ignore';

  if (isShrimpLiffOpenCommand(raw)) {
    return applyShrimpGroupOrdersOnlyFilter('open_liff', groupId);
  }

  if (SHRIMP_HELP_EN_CMD.test(raw) && !isShrimpSessionContinuation(session) && !isShrimpOrderCommand(raw)) {
    return applyShrimpGroupOrdersOnlyFilter('help_en', groupId);
  }

  if (SHRIMP_HELP_CMD.test(raw)) {
    return applyShrimpGroupOrdersOnlyFilter('help', groupId);
  }
  if (isShrimpCancelCommand(raw)) {
    return applyShrimpGroupOrdersOnlyFilter('cancel_order', groupId);
  }

  if (session?.customerLink?.step === 'shop_name') {
    return applyShrimpGroupOrdersOnlyFilter('link_customer', groupId);
  }
  if (isLinkCustomerCommand(raw)) {
    return applyShrimpGroupOrdersOnlyFilter('link_customer', groupId);
  }

  // สรุปต้องทำงานแม้มี session ค้าง (กลุ่มครอบครัวพิมพ์สรุประหว่างสั่ง)
  if (isShrimpTodayOrdersCommand(raw)) return 'today_orders';
  if (isShrimpSummaryCommand(raw)) return 'summary';

  if (isShrimpGroupChat(groupId)) {
    const groupKey = classifyShrimpGroupKeyboard(raw);
    if (groupKey) return groupKey;
  }

  if (isShrimpSessionContinuation(session)) return 'order';

  if (isShrimpOrderCommand(raw)) return 'order';

  return 'ignore';
}

module.exports = {
  classifyShrimpLineMessage,
  isShrimpOrderCommand,
  isShrimpCancelCommand,
  isShrimpLiffOpenCommand,
  hasOrderBody,
  isShrimpSessionContinuation,
  SHRIMP_HELP_EN_CMD,
};
