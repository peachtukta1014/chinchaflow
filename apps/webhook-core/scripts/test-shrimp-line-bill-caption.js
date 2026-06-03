const assert = require('assert');
const {
  lineBillUnpaidHint,
  lineBillPaidThankYouCaption,
  LINE_BILL_PAID_THANK_YOU,
  LINE_BILL_TRANSFER_ACCOUNTS_TEXT,
} = require('../src/shrimpLinePush');

assert.strictEqual(lineBillUnpaidHint('cash', 0, 1000), '');
assert.strictEqual(lineBillUnpaidHint('transfer', 0, 1000), '');

assert.strictEqual(lineBillPaidThankYouCaption('transfer', 0, 3520), LINE_BILL_PAID_THANK_YOU);
assert.strictEqual(lineBillPaidThankYouCaption('cash', 0, 1000), LINE_BILL_PAID_THANK_YOU);
assert.strictEqual(lineBillPaidThankYouCaption('credit', 0, 3520), '');
assert.strictEqual(lineBillPaidThankYouCaption('transfer', 500, 3520), '');
assert.strictEqual(lineBillPaidThankYouCaption('credit', null, 3520), '');

const credit = lineBillUnpaidHint('credit', null, 3520);
assert.ok(credit.includes('ค้างชำระ ฿3,520'), credit);
assert.ok(credit.includes(LINE_BILL_TRANSFER_ACCOUNTS_TEXT), credit);
assert.ok(credit.includes('<tel:5382038136|538 203 8136>'), credit);
assert.ok(credit.includes('<tel:0949408665|094 940 8665>'), credit);

const partial = lineBillUnpaidHint('credit', 500, 3520);
assert.ok(partial.includes('ค้างชำระ ฿500'), partial);

console.log('all shrimp line bill caption tests passed');
