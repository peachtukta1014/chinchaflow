const assert = require('assert');
const {
  deliveryWindowFromConfig,
  DEFAULT_DELIVERY_WINDOW,
} = require('../src/shrimpLineConfig');

assert.deepStrictEqual(DEFAULT_DELIVERY_WINDOW, { startHour: 18, endHour: 15 });
assert.deepStrictEqual(deliveryWindowFromConfig(null), { startHour: 18, endHour: 15 });
assert.deepStrictEqual(
  deliveryWindowFromConfig({ lineDefaultStartHour: 17, lineDefaultEndHour: 14 }),
  { startHour: 17, endHour: 14 },
);
assert.deepStrictEqual(
  deliveryWindowFromConfig({ lineDefaultStartHour: 99, lineDefaultEndHour: -1 }),
  { startHour: 18, endHour: 15 },
);

console.log('all shrimpLineConfig tests passed');
