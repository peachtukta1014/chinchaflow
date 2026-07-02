#!/usr/bin/env node
const assert = require('assert');
const {
  buildLiffCustomerCatalog,
  loadCustomerById,
} = require('../src/seafood-oa/shrimpBuiltinCustomers');

function mockDb(docs) {
  const byId = new Map(docs.map((d) => [d.id, d]));
  return {
    collection(name) {
      assert.strictEqual(name, 'customers');
      const query = {
        limit: () => query,
        get: async () => ({
          docs: [...byId.values()].map((data) => ({
            id: data.id,
            data: () => {
              const { id, ...rest } = data;
              return rest;
            },
          })),
        }),
        doc(id) {
          return {
            get: async () => {
              const row = byId.get(id);
              if (!row) return { exists: false };
              const { id: docId, ...rest } = row;
              return { exists: true, id: docId, data: () => rest };
            },
          };
        },
      };
      return query;
    },
  };
}

(async () => {
  const db = mockDb([
    { id: 'c1', name: 'จ๊ะขียด (Firestore)', zone: 'ป่าตอง' },
    {
      id: 'cx_oa1',
      name: 'ร้านจาก OA',
      zone: 'LINE OA',
      lineUserId: 'Uoa111',
    },
    { id: 'c5', hidden: true, name: 'ซ่อน' },
  ]);

  const catalog = await buildLiffCustomerCatalog(db);
  assert(catalog.some((c) => c.id === 'cx_oa1' && c.name === 'ร้านจาก OA'), 'OA customer in catalog');
  assert(catalog.some((c) => c.id === 'c1' && c.name === 'จ๊ะขียด (Firestore)'), 'builtin merged with firestore');
  assert(!catalog.some((c) => c.id === 'c5'), 'hidden builtin excluded');
  assert(!catalog.some((c) => c.id === 'general'), 'general excluded');
  assert(catalog.length >= 27, 'includes main shops');

  const fromFs = await loadCustomerById(db, 'cx_oa1');
  assert(fromFs?.name === 'ร้านจาก OA', 'load cx by id');

  const fromBuiltin = await loadCustomerById(mockDb([]), 'c2');
  assert(fromBuiltin?.name === 'ตาจุ้ยหนึ่ง', 'load builtin without firestore doc');

  console.log('test-shrimp-liff-customers: ok');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
