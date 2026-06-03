const assert = require('assert');
const {
  appendLineContact,
  customerHasLineUserId,
  getBillingLineUserId,
  LINE_CONTACT_ROLE_BILLING,
  LINE_CONTACT_ROLE_ORDER,
  normalizeLineContacts,
} = require('../src/lineCustomerContacts');

const billing = 'Uaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1';
const order = 'Ubbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb2';

const shop = normalizeLineContacts({
  lineContacts: [
    { uid: billing, role: LINE_CONTACT_ROLE_BILLING },
    { uid: order, role: LINE_CONTACT_ROLE_ORDER },
  ],
});
assert.strictEqual(getBillingLineUserId({ lineContacts: shop }), billing);
assert(customerHasLineUserId({ lineContacts: shop }, order));

const added = appendLineContact(shop, 'Uccccccccccccccccccccccccccccccc3', LINE_CONTACT_ROLE_ORDER);
assert.strictEqual(added.length, 3);

const first = appendLineContact([], billing, LINE_CONTACT_ROLE_BILLING);
assert.strictEqual(first[0].role, LINE_CONTACT_ROLE_BILLING);

console.log('all lineCustomerContacts tests passed');
