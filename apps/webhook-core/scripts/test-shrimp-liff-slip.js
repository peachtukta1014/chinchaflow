#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const {
  decodeImageBase64,
} = require('../src/shrimpLiffSlip');
const {
  getShrimpSlipLiffOpenUrl,
  liffOpenUrl,
  SLIP_DEFAULT_ENDPOINT,
  readSlipLiffIdFromRepo,
  resolveShrimpSlipLiffId,
} = require('../src/provisionShrimpLiff');
const { lineBillUnpaidHint } = require('../src/shrimpLinePush');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  console.log('ok:', msg);
}

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const b64 = `data:image/png;base64,${tinyPng.toString('base64')}`;
assert(decodeImageBase64(b64)?.length === tinyPng.length, 'decodeImageBase64');

const slipHandler = fs.readFileSync(
  path.join(__dirname, '../src/shrimpLiffSlip.js'),
  'utf8',
);
assert(
  slipHandler.includes('verified.lineUserId'),
  'shrimpLiffSlip uses verified.lineUserId from verifyLineLiffIdToken',
);
assert(
  !slipHandler.includes('verified.sub'),
  'shrimpLiffSlip must not read verified.sub (verifyLineLiffIdToken returns lineUserId)',
);

process.env.LINE_LIFF_SLIP_ID = '2010271574-SlipTest01';
const url = getShrimpSlipLiffOpenUrl('BILL-001');
assert(url.includes('liff.line.me/2010271574-SlipTest01'), 'slip liff url');
assert(url.includes('billNo=BILL-001'), 'slip liff billNo query');

const hint = lineBillUnpaidHint('credit', 500, 500, 'BILL-99');
assert(hint.includes('ฝากสลิป'), 'unpaid bill hint has slip');
assert(hint.includes('liff.line.me'), 'unpaid bill hint has liff url');

const slipHtml = path.join(__dirname, '../../seafood-pos/liff-slip.html');
assert(fs.existsSync(slipHtml), 'liff-slip.html exists');
const slipApp = fs.readFileSync(
  path.join(__dirname, '../../seafood-pos/src/liff/LineSlipLiffApp.jsx'),
  'utf8',
);
assert(slipApp.includes('ฝากสลิป'), 'LineSlipLiffApp copy');
assert(slipApp.includes('เลือกรูปจากคลังภาพ'), 'slip LIFF gallery picker');
assert(!slipApp.includes('capture='), 'slip LIFF must not force camera');
assert(SLIP_DEFAULT_ENDPOINT.includes('liff-slip.html'), 'slip default endpoint');
assert(typeof readSlipLiffIdFromRepo === 'function', 'readSlipLiffIdFromRepo export');
delete process.env.LINE_LIFF_SLIP_ID;
delete process.env.VITE_LIFF_SLIP_ID;
assert(resolveShrimpSlipLiffId() === readSlipLiffIdFromRepo(), 'resolveShrimpSlipLiffId reads repo json');

console.log('\nall shrimp liff slip tests passed\n');
console.log('Rich Menu B URI (ตั้งใน LINE Manager):', liffOpenUrl('2010271574-SlipTest01'));
console.log('Endpoint:', SLIP_DEFAULT_ENDPOINT);
