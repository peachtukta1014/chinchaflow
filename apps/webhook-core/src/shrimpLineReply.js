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
  help: {
    th: () => [
      '🤖 บอทร้านกุ้ง — โกอ้วน คลังซีฟู้ด',
      '',
      'สั่งออเดอร์ (ไทย / พม่า / English):',
      '• ปุ้ย กลาง 6 กก · กุ้งแม่น้ำ 6.6 กก',
      '• Peach 6.6 kg m · River prawn 4 kg → pick size',
      '• 5 b 4 (รหัสร้าน · กลาง · 4 กก)',
      '• พิมพ์ ฟอร์ม — เปิดฟอร์มสั่ง (แชต OA 1:1)',
      '• help · ยกเลิก',
      '',
      `น้ำหนัก ${MIN_WEIGHT_KG}–${MAX_WEIGHT_KG} กก. · ในแอปบันทึกเป็นภาษาไทย — ตอบตามภาษาที่พิมพ์`,
    ].join('\n'),
    my: () => [
      '🤖 ကုန်ကြမ်း ဂဏန်း',
      '',
      'အော်ဒါ (မြန်မာ / English / ไทย):',
      '• ဖောက်သည်အမည် + ကိုယ်အလေးချိန် + သေး/လယ်/ကြီး',
      `• မြစ်ပုစွန် 6.6 kg · ${MIN_WEIGHT_KG}–${MAX_WEIGHT_KG} kg`,
      '• form — ဖောင် (OA 1:1)',
      '• help · cancel',
    ].join('\n'),
    en: () => [
      '🤖 Ko Auan seafood bot',
      '',
      'Order (English / Myanmar / Thai):',
      '• Customer name + weight + s/m/l — e.g. Peach 6.6 kg m',
      `• River prawn 6.6 kg → then size (${MIN_WEIGHT_KG}–${MAX_WEIGHT_KG} kg)`,
      '• form — open order form (OA direct chat)',
      '• help · cancel',
      '',
      'Saved in Thai in the app — replies match your language',
    ].join('\n'),
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
  replyCancelFail,
  replyInvalidWeight,
  formatItemsSummary,
  deliveryLabelForLang,
  orderFormatHelp,
};
