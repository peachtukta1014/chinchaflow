#!/usr/bin/env node
const { translateOrderTextToThai, normalizeQuantityText } = require('../src/translateOrderText');
const { detectMessageLang } = require('../src/orderMessageLang');
const { prepareOrderInput } = require('../src/prepareOrderInput');
const {
  parseRiverPrawnPendingLine,
  parseSimpleOrderLine,
} = require('../src/parseLineOrder');
const { classifyShrimpLineMessage } = require('../src/shrimpLineIntent');
const {
  replyRiverPrompt,
  replyOrderOk,
  replyHelpCustomerThai,
  replyHelpCustomerEnglish,
} = require('../src/shrimpLineReply');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  console.log('ok:', msg);
}

assert(normalizeQuantityText('2,5') === '2.5', 'comma decimal');
assert(detectMessageLang('ဂဏန်း အလယ် 2.5 kg') === 'my', 'detect myanmar');
assert(detectMessageLang('river prawn 2.5 kg') === 'en', 'detect english');

const myBody = translateOrderTextToThai('river prawn 2.5 kg');
assert(/กุ้งแม่น้ำ/.test(myBody), 'EN river prawn → กุ้งแม่น้ำ');

const prep = prepareOrderInput('river prawn 2.5 kg', null);
assert(prep.replyLang === 'en', 'reply lang en');
const pending = parseRiverPrawnPendingLine(prep.body);
assert(pending?.qty === 2.5, 'parse 2.5 kg river after translate');

assert(
  classifyShrimpLineMessage('river prawn 2.5 kg', null) === 'order',
  'intent order for english',
);

const myReply = replyRiverPrompt('my', { qty: 2.5, unit: 'กก' }, '2026-05-31');
assert(/သေး/.test(myReply), 'river prompt burmese');

const thReply = replyOrderOk('th', 1, '2026-05-31', [
  { product: 'กุ้งกลาง', qty: 2, unit: 'กก', customerName: 'ปุ้ย' },
]);
assert(/รับออเดอร์/.test(thReply), 'order ok thai');

assert(classifyShrimpLineMessage('ช่วยเหลือ', null) === 'help', 'help intent thai');
assert(classifyShrimpLineMessage('สอบถาม', null) === 'help', 'help intent สอบถาม rich menu');
assert(classifyShrimpLineMessage('EN', null) === 'help_en', 'help_en intent');
assert(classifyShrimpLineMessage('2', null) === 'help_en', 'help_en digit 2');

const helpTh = replyHelpCustomerThai();
assert(/สั่งได้ 2 ทาง/.test(helpTh), 'help th short how-to');
assert(/094-940-8665/.test(helpTh), 'help th contact phone peach');
assert(/ภาษาอังกฤษ: พิมพ์ EN/.test(helpTh), 'help th english switch');
assert(!/မြန်မာ|အော်ဒါ/.test(helpTh), 'help th no burmese block');

const helpEn = replyHelpCustomerEnglish();
assert(/How to order/.test(helpEn), 'help en short how-to');
assert(/ภาษาไทย: พิมพ์ ช่วยเหลือ/.test(helpEn), 'help en thai switch hint');

console.log('\nall shrimp i18n order tests passed\n');
