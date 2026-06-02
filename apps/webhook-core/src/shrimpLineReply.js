const { formatDateThai } = require('./parseDeliveryDate');
const { MIN_WEIGHT_KG, MAX_WEIGHT_KG } = require('./orderWeight');

const PRODUCT_LABEL = {
  th: {
    'กุ้งใหญ่': 'กุ้งใหญ่',
    'กุ้งกลาง': 'กุ้งกลาง',
    'กุ้งเล็ก': 'กุ้งเล็ก',
    'กุ้งตาย': 'กุ้งตาย',
  },
  my: {
    'กุ้งใหญ่': 'ဂဏန်း အကြီး',
    'กุ้งกลาง': 'ဂဏန်း အလယ်',
    'กุ้งเล็ก': 'ဂဏန်း သေး',
    'กุ้งตาย': 'ဂဏန်း သေ',
  },
  en: {
    'กุ้งใหญ่': 'Large shrimp',
    'กุ้งกลาง': 'Medium shrimp',
    'กุ้งเล็ก': 'Small shrimp',
    'กุ้งตาย': 'Dead shrimp',
  },
};

function L(lang) {
  return lang === 'my' || lang === 'en' ? lang : 'th';
}

function productLabel(lang, product) {
  const key = L(lang);
  return PRODUCT_LABEL[key][product] || product;
}

function formatItemsSummary(items, lang) {
  return items
    .map((i) => {
      const who = i.customerName ? `${i.customerName} · ` : '';
      const p = productLabel(lang, i.product);
      return `• ${who}${p} ${i.qty} ${i.unit}`;
    })
    .join('\n');
}

function deliveryLabelForLang(deliveryDate, lang) {
  const th = formatDateThai(deliveryDate);
  const key = L(lang);
  if (key === 'my') return `ပို့ဆောင်ရက် ${th} (${deliveryDate})`;
  if (key === 'en') return `Delivery ${th} (${deliveryDate})`;
  return `${th} (${deliveryDate})`;
}

const M = {
  orderOk: {
    th: (n, dl, summary) =>
      `✅ รับออเดอร์แล้วครับ (${n} ราย)\n📅 ส่ง ${dl}\n\n${summary}`,
    my: (n, dl, summary) =>
      `✅ အော်ဒါ လက်ခံပြီး (${n})\n📅 ${dl}\n\n${summary}`,
    en: (n, dl, summary) =>
      `✅ Order received (${n})\n📅 ${dl}\n\n${summary}`,
  },
  parseFail: {
    th: (help) => `ยังอ่านรายการไม่ได้ครับ\n\n${help}`,
    my: (help) => `ဖတ်မရသေးပါ\n\n${help}`,
    en: (help) => `Could not read the order.\n\n${help}`,
  },
  deliverySet: {
    th: (dl) =>
      `📅 ตั้งวันส่ง ${dl}\nพิมพ์ชื่อลูกค้า น้ำหนัก หรือ ใหญ่/กลาง/เล็ก ได้เลยครับ`,
    my: (dl) =>
      `📅 ပို့ဆောင်ရက် ${dl}\nဖောက်သည်အမည် · ကိုယ်အလေးချိန် · သေး/လယ်/ကြီး ပို့ပါ`,
    en: (dl) =>
      `📅 Delivery set: ${dl}\nSend customer name, weight, or size (S/M/L).`,
  },
  simplePending: {
    th: (name, qty, unit, dl) =>
      `📝 รับ ${name} ${qty} ${unit}\nส่ง ${dl} — พิมพ์ ใหญ่ / กลาง / เล็ก ต่อได้ครับ`,
    my: (name, qty, unit, dl) =>
      `📝 ${name} ${qty} ${unit}\n${dl} — သေး / လယ် / ကြီး ပို့ပါ`,
    en: (name, qty, unit, dl) =>
      `📝 ${name} ${qty} ${unit}\n${dl} — reply small / medium / large`,
  },
  sizeOnlyFirst: {
    th: () => 'พิมพ์ชื่อลูกค้าและน้ำหนักก่อน แล้วค่อยส่ง กลาง/ใหญ่/เล็ก ครับ',
    my: () => 'ဖောက်သည်အမည် + ကိုယ်အလေးချိန် ပို့ပါ — ပြီးမှ သေး/လယ်/ကြီး',
    en: () => 'Send customer name and weight first, then size (S/M/L).',
  },
  riverPrompt: {
    th: (who, qty, unit, dl) => {
      const head = who
        ? `📝 ${who}กุ้งแม่น้ำ ${qty} ${unit}`
        : `📝 กุ้งแม่น้ำ ${qty} ${unit}`;
      const dateLine = dl ? `\n📅 ส่ง ${dl}` : '';
      return (
        `${head}${dateLine}\n\n`
        + '🦐 กุ้งแม่น้ำ — เลือกขนาดก่อนยืนยันครับ\n'
        + '• เล็ก 850 บาท/กก\n'
        + '• กลาง 1,100 บาท/กก\n'
        + '• ใหญ่ 1,450 บาท/กก\n\n'
        + 'พิมพ์ เล็ก / กลาง / ใหญ่ (หรือ c / b / a)'
      );
    },
    my: (who, qty, unit, dl) => {
      const head = who
        ? `📝 ${who} မြစ်ပုစွန် ${qty} ${unit}`
        : `📝 မြစ်ပုစွန် ${qty} ${unit}`;
      const dateLine = dl ? `\n📅 ${dl}` : '';
      return (
        `${head}${dateLine}\n\n`
        + '🦐 အရွယ်ရွေးပါ\n'
        + '• သေး (c) 850\n'
        + '• လယ် (b) 1,100\n'
        + '• ကြီး (a) 1,450\n\n'
        + 'သေး / လယ် / ကြီး သို့မဟုတ် c / b / a'
      );
    },
    en: (who, qty, unit, dl) => {
      const head = who
        ? `📝 ${who} River prawn ${qty} ${unit}`
        : `📝 River prawn ${qty} ${unit}`;
      const dateLine = dl ? `\n📅 ${dl}` : '';
      return (
        `${head}${dateLine}\n\n`
        + '🦐 Pick a size:\n'
        + '• Small (c) 850/kg\n'
        + '• Medium (b) 1,100/kg\n'
        + '• Large (a) 1,450/kg\n\n'
        + 'Reply: small / medium / large or c / b / a'
      );
    },
  },
  missingProfile: {
    th: (lines) => ['📋 ก่อนยืนยันออเดอร์ ขอข้อมูลลูกค้าให้ครบครับ', ...lines].join('\n'),
    my: (lines) => ['📋 အော်ဒါမတိုင်မီ ဖောက်သည်အချက်အလက်', ...lines].join('\n'),
    en: (lines) => ['📋 Before confirming, need customer info:', ...lines].join('\n'),
  },
  /** ข้อความช่วยเหลือลูกค้า OA — ไทยเป็นหลัก (ไม่รวมพม่าในเมนูนี้; สั่งพม่าในแชตยังรับตามเดิม) */
  helpCustomerTh: () => [
    'โกอ้วน คลังซีฟู้ด',
    'Ko Ao Seafood',
    '',
    'คู่มือการสั่งซื้อและติดต่อร้าน',
    '',
    '【วิธีสั่ง】',
    '1. เมนูด้านล่าง 「สั่งกุ้ง」— เปิดแบบฟอร์มสั่ง',
    '2. เมนู 「แชท」— สั่งด้วยข้อความในแชตนี้',
    '',
    '【รูปแบบข้อความ (ตัวอย่าง)】',
    '• [ชื่อร้าน] [ขนาด] [น้ำหนัก] — เช่น ปุ้ย กลาง 6 กก.',
    '• กุ้งแม่น้ำ [น้ำหนัก] กก. จากนั้นระบุ เล็ก / กลาง / ใหญ่',
    '• พิมพ์ ฟอร์ม — เปิดแบบฟอร์ม (เฉพาะแชตตรงกับร้าน)',
    '',
    '【แนวทาง】',
    `• น้ำหนักที่รับต่อรายการ: ${MIN_WEIGHT_KG}–${MAX_WEIGHT_KG} กก.`,
    '• ยกเลิกออเดอร์: พิมพ์「ยกเลิก」ก่อนร้านจัดส่ง',
    '• ชำระเงินแล้ว: ส่งรูปสลิปโอนในแชตนี้',
    '• ข้อมูลไม่ครบ: ระบบจะขอชื่อร้าน / เบอร์ / จุดส่งก่อนยืนยัน',
    '',
    '【ติดต่อเจ้าหน้าที่】',
    '• ตอบในแชต LINE นี้ หรือโทร 094-669-3628',
    '• เวลาทำการตามที่ร้านแจ้ง — นอกเวลาอาจตอบช้า',
    '',
    '—',
    'English: พิมพ์ 2 หรือ EN',
  ].join('\n'),
  helpCustomerEn: () => [
    'Ko Ao Seafood',
    'โกอ้วน คลังซีฟู้ด',
    '',
    'Ordering & contact guide',
    '',
    '[How to order]',
    '1. Bottom menu 「Order shrimp」— order form',
    '2. Bottom menu 「Chat」— place your order in this chat',
    '',
    '[Message format — examples]',
    '• [Shop name] [size] [weight] — e.g. Peach medium 6 kg',
    '• River prawn [weight] kg, then reply small / medium / large',
    '• Type form — order form (direct chat with our LINE only)',
    '',
    '[Guidelines]',
    `• Weight per line: ${MIN_WEIGHT_KG}–${MAX_WEIGHT_KG} kg`,
    '• Cancel: type cancel before we dispatch your order',
    '• After payment: send your transfer slip image here',
    '• Missing details: we will ask for shop name, phone, and delivery notes',
    '',
    '[Contact]',
    '• Reply in this LINE chat or call 094-669-3628',
    '• Replies follow our business hours; off-hours may be delayed',
    '',
    '—',
    'ภาษาไทย: พิมพ์ ช่วยเหลือ',
  ].join('\n'),
  /** ใช้กับ parse fail / ข้อความอื่นที่ยังอิงภาษาตามข้อความลูกค้า */
  help: {
    th: () => M.helpCustomerTh(),
    my: () => M.helpCustomerTh(),
    en: () => M.helpCustomerEn(),
  },
  cancelFail: {
    th: () => '⚠️ ยกเลิกออเดอร์ไม่สำเร็จ ลองใหม่หรือแจ้งพนักงานโดยตรงครับ',
    my: () => '⚠️ ပယ်ဖျက် မအောင်မြင်',
    en: () => '⚠️ Could not cancel — try again or contact staff',
  },
  invalidWeight: {
    th: (qty, unit) =>
      `⚠️ น้ำหนัก ${qty} ${unit || 'กก'} รับไม่ได้ครับ\n`
      + `กรุณาระบุ ${MIN_WEIGHT_KG}–${MAX_WEIGHT_KG} กก. (เช่น 6 · 6.6 · 2.5)`,
    my: (qty, unit) =>
      `⚠️ ${qty} ${unit || 'kg'} — လက်မခံ\n`
      + `${MIN_WEIGHT_KG}–${MAX_WEIGHT_KG} kg`,
    en: (qty, unit) =>
      `⚠️ Weight ${qty} ${unit || 'kg'} is out of range.\n`
      + `Use ${MIN_WEIGHT_KG}–${MAX_WEIGHT_KG} kg (e.g. 6 · 6.6 · 2.5).`,
  },
};

function orderFormatHelp(lang) {
  return M.help[L(lang)]();
}

function replyOrderOk(lang, orderCount, deliveryDate, items) {
  const dl = deliveryLabelForLang(deliveryDate, lang);
  const summary = formatItemsSummary(items, lang);
  return M.orderOk[L(lang)](orderCount, dl, summary);
}

function replyParseFail(lang) {
  return M.parseFail[L(lang)](orderFormatHelp(lang));
}

function replyDeliverySet(lang, deliveryDate) {
  const dl = deliveryLabelForLang(deliveryDate, lang);
  return M.deliverySet[L(lang)](dl);
}

function replySimplePending(lang, name, qty, unit, deliveryDate) {
  const dl = formatDateThai(deliveryDate);
  return M.simplePending[L(lang)](name, qty, unit, dl);
}

function replySizeOnlyFirst(lang) {
  return M.sizeOnlyFirst[L(lang)]();
}

function replyRiverPrompt(lang, pending, deliveryDate) {
  const who = pending?.customerName ? `${pending.customerName} · ` : '';
  const dl = deliveryDate ? deliveryLabelForLang(deliveryDate, lang) : '';
  return M.riverPrompt[L(lang)](who, pending.qty, pending.unit || 'กก', dl);
}

function replyMissingProfile(lang, missing, { itemsSummary, deliveryDateLabel }) {
  const key = L(lang);
  const lines = [];
  if (deliveryDateLabel) {
    lines.push(key === 'my' ? `📅 ${deliveryDateLabel}` : `📅 ${deliveryDateLabel}`);
  }
  if (itemsSummary) lines.push('', itemsSummary);
  lines.push('');
  if (key === 'my') {
    lines.push('ပို့ပါ:');
    if (missing.includes('name')) lines.push('• ဆိုင်အမည်');
    if (missing.includes('phone')) lines.push('• ဖုန်း');
    if (missing.includes('notes')) lines.push('• မှတ်ချက်');
  } else if (key === 'en') {
    lines.push('Please send:');
    if (missing.includes('name')) lines.push('• Shop name');
    if (missing.includes('phone')) lines.push('• Phone');
    if (missing.includes('notes')) lines.push('• Notes');
  } else {
    lines.push('กรุณาแจ้ง:');
    if (missing.includes('name')) lines.push('• ชื่อลูกค้า / ร้าน');
    if (missing.includes('phone')) lines.push('• เบอร์ติดต่อ');
    if (missing.includes('notes')) lines.push('• จุดส่ง / หมายเหตุ');
  }
  return M.missingProfile[key](lines);
}

function replyHelpCustomerThai() {
  return M.helpCustomerTh();
}

function replyHelpCustomerEnglish() {
  return M.helpCustomerEn();
}

/** @deprecated ใช้ replyHelpCustomerThai / replyHelpCustomerEnglish สำหรับเมนูช่วยเหลือ */
function replyHelp(lang) {
  return M.help[L(lang)]();
}

function replyCancelFail(lang) {
  return M.cancelFail[L(lang)]();
}

function replyInvalidWeight(lang, qty, unit) {
  return M.invalidWeight[L(lang)](qty, unit);
}

module.exports = {
  replyOrderOk,
  replyParseFail,
  replyDeliverySet,
  replySimplePending,
  replySizeOnlyFirst,
  replyRiverPrompt,
  replyMissingProfile,
  replyHelp,
  replyHelpCustomerThai,
  replyHelpCustomerEnglish,
  replyCancelFail,
  replyInvalidWeight,
  formatItemsSummary,
  deliveryLabelForLang,
  orderFormatHelp,
};
