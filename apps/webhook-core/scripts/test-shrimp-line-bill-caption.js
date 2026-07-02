const assert = require('assert');
const {
  lineBillUnpaidHint,
  lineBillPaidThankYouCaption,
  LINE_BILL_PAID_THANK_YOU,
  buildLineBillTransferAccountsText,
} = require('../src/seafood-notify/shrimpLinePush');

assert.strictEqual(lineBillUnpaidHint('cash', 0, 1000), '');
assert.strictEqual(lineBillUnpaidHint('transfer', 0, 1000), '');

assert.strictEqual(lineBillPaidThankYouCaption('transfer', 0, 3520), LINE_BILL_PAID_THANK_YOU);
assert.strictEqual(lineBillPaidThankYouCaption('cash', 0, 1000), LINE_BILL_PAID_THANK_YOU);
assert.strictEqual(lineBillPaidThankYouCaption('credit', 0, 3520), '');
assert.strictEqual(lineBillPaidThankYouCaption('transfer', 500, 3520), '');
assert.strictEqual(lineBillPaidThankYouCaption('credit', null, 3520), '');

const accounts = buildLineBillTransferAccountsText();
assert.ok(accounts.includes('บัญชีแม่'), accounts);
assert.ok(accounts.includes('กสิกรไทย / KBank'), accounts);
assert.ok(accounts.includes('538 203 8136'), accounts);
assert.ok(accounts.includes('วิไลรัตน์ จินดาพล'), accounts);
assert.ok(accounts.includes('บัญชีพีช'), accounts);
assert.ok(accounts.includes('033 3318 237'), accounts);
assert.ok(accounts.includes('อภินันท์ ชัยราบ (พีช)'), accounts);
assert.ok(accounts.includes('พร้อมเพย์ / PromptPay'), accounts);
assert.ok(accounts.includes('094 940 8665'), accounts);
assert.ok(!accounts.includes('<tel:'), accounts);

const credit = lineBillUnpaidHint('credit', null, 3520);
assert.ok(credit.includes('ค้างชำระ ฿3,520'), credit);
assert.ok(credit.includes('บัญชีแม่'), credit);
assert.ok(credit.includes('พร้อมเพย์'), credit);
assert.ok(!credit.includes('<tel:'), credit);

const partial = lineBillUnpaidHint('credit', 500, 3520);
assert.ok(partial.includes('ค้างชำระ ฿500'), partial);

console.log('all shrimp line bill caption tests passed');
