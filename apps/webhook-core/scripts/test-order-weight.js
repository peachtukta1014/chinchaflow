#!/usr/bin/env node
const { MIN_WEIGHT_KG, MAX_WEIGHT_KG, getOrderWeightIssue, isValidOrderWeight } = require('../src/orderWeight');
const { prepareOrderInput } = require('../src/prepareOrderInput');
const {
  parseRiverPrawnPendingLine,
  parseRiverPrawnWithSize,
  parseSimpleOrderLine,
  parseOrderItems,
} = require('../src/parseLineOrder');
const { classifyShrimpLineMessage } = require('../src/shrimpLineIntent');
const { replyInvalidWeight } = require('../src/shrimpLineReply');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  console.log('ok:', msg);
}

assert(isValidOrderWeight(0.01, 'kg'), 'min 0.01 kg');
assert(isValidOrderWeight(20, 'กก'), 'max 20 kg');
assert(isValidOrderWeight(6.6, 'kg'), '6.6 kg');
assert(isValidOrderWeight(2.5, 'kg'), '2.5 kg');
assert(getOrderWeightIssue(0.005, 'kg') === 'too_light', 'below min');
assert(getOrderWeightIssue(25, 'kg') === 'too_heavy', 'above max');
assert(getOrderWeightIssue(500, 'บาท') === null, 'baht not validated');

const prep66 = prepareOrderInput('river prawn 6.6 kg', null);
const pending66 = parseRiverPrawnPendingLine(prep66.body);
assert(pending66?.qty === 6.6, 'river prawn 6.6 kg pending');

const prepTrail = prepareOrderInput('river prawn 6.6 kg small', null);
const trailItems = parseOrderItems(prepTrail.body);
assert(trailItems.length === 1 && trailItems[0].qty === 6.6, 'river 6.6 kg + size one-shot');

const prepPeach = prepareOrderInput('Peach 6.6 kg m', null);
const peach = parseSimpleOrderLine(prepPeach.body);
assert(peach?.kind === 'item' && peach.qty === 6.6, 'Peach 6.6 kg m');

const prepHeavy = prepareOrderInput('Peach 25 kg m', null);
const heavy = parseSimpleOrderLine(prepHeavy.body);
assert(heavy?.kind === 'invalid_weight', '25 kg rejected');

assert(classifyShrimpLineMessage('Peach 25 kg m', null) === 'order', 'heavy weight still order intent');

const thReject = replyInvalidWeight('th', 25, 'กก');
assert(/0\.01/.test(thReject) && /20/.test(thReject), 'invalid weight reply th');

const sized = parseRiverPrawnWithSize('กุ้งแม่น้ำ เล็ก 6.6 กก');
assert(sized[0]?.qty === 6.6, 'กุ้งแม่น้ำ เล็ก 6.6');

console.log(`\nall order weight tests passed (${MIN_WEIGHT_KG}–${MAX_WEIGHT_KG} kg)\n`);
