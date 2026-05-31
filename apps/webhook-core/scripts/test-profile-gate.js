#!/usr/bin/env node
const {
  MAIN_CATALOG_SHOP_IDS,
  PROFILE_GATE_MIN_LINKED_SHOPS,
  profileMissingFields,
} = require('../src/shrimpLineCustomerProfile');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  console.log('ok:', msg);
}

assert(MAIN_CATALOG_SHOP_IDS.size === 27, '27 main shop ids');
assert(MAIN_CATALOG_SHOP_IDS.has('c1') && MAIN_CATALOG_SHOP_IDS.has('c27'), 'c1 and c27');
assert(!MAIN_CATALOG_SHOP_IDS.has('general'), 'general not in gate set');
assert(PROFILE_GATE_MIN_LINKED_SHOPS === 27, 'gate threshold 27');

assert(
  profileMissingFields({ name: 'ร้าน A', lineUserId: 'U' + 'a'.repeat(32) }).length === 0,
  'linked customer skips phone/notes',
);
assert(
  profileMissingFields({ name: 'ใหม่' }).includes('phone'),
  'unlinked new customer needs phone',
);

console.log('\nall profile gate tests passed\n');
