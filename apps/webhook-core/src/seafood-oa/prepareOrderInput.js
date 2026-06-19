const { parseDeliveryDateFromText } = require('./parseDeliveryDate');
const { translateOrderTextToThai } = require('./translateOrderText');
const { detectMessageLang, resolveReplyLang } = require('./orderMessageLang');

/**
 * ข้อความ LINE → ภาษาตอบกลับ + ข้อความไทยสำหรับ parse
 */
function prepareOrderInput(text, session) {
  const raw = String(text || '').trim();
  const replyLang = resolveReplyLang(raw, session);
  const { dateKey, textWithoutDate } = parseDeliveryDateFromText(raw);
  const bodyRaw = (textWithoutDate || raw).trim();
  const bodyTh = translateOrderTextToThai(bodyRaw);
  const textTh = dateKey && !bodyTh
    ? raw
    : translateOrderTextToThai(raw);

  return {
    replyLang,
    parsedDate: dateKey,
    body: bodyTh || bodyRaw,
    textForParse: bodyTh || textTh,
    raw,
  };
}

module.exports = {
  prepareOrderInput,
  detectMessageLang,
};
