const { groupItemsByCustomer } = require('./parseLineOrder');
const { linkLineUserToCustomers, findCustomerNameByLineUserId } = require('./shrimpLinePush');
const {
  applySyncedCustomerNameToItems,
  resolveLineOrderCustomerName,
} = require('./lineOrderCustomerName');

/**
 * บันทึก lineOrders จากแชท LINE หรือ LIFF
 * @returns {Promise<number>} จำนวนออเดอร์ที่สร้าง
 */
async function saveLineOrders(db, admin, {
  items,
  text,
  userId,
  groupId = null,
  deliveryDate,
  source = 'line',
  customerId = null,
  explicitCustomerName = null,
  autoLinkLineUid = true,
}) {
  let linkedCustomerName = explicitCustomerName
    ? String(explicitCustomerName).trim()
    : null;
  if (!linkedCustomerName && userId && !groupId) {
    linkedCustomerName = await findCustomerNameByLineUserId(db, userId);
  }

  const { items: normalizedItems } = applySyncedCustomerNameToItems({
    items,
    groupId,
    linkedCustomerName,
  });
  const groups = groupItemsByCustomer(normalizedItems);
  const batch = db.batch();
  const ts = admin.firestore.FieldValue.serverTimestamp();

  for (const [key, groupItems] of groups) {
    const parsedName = key === '__none__' ? null : key;
    const customerName = resolveLineOrderCustomerName({
      parsedName,
      groupId,
      linkedCustomerName,
    });
    const ref = db.collection('lineOrders').doc();
    batch.set(ref, {
      source,
      customerId: customerId || null,
      lineUserId: userId,
      lineGroupId: groupId,
      rawText: text,
      items: groupItems.map((i) => ({
        product: i.product,
        qty: i.qty,
        unit: i.unit,
        customerName: resolveLineOrderCustomerName({
          parsedName: i.customerName || parsedName,
          groupId,
          linkedCustomerName,
        }),
      })),
      deliveryDate,
      customerName,
      status: 'pending',
      createdAt: ts,
    });
  }
  await batch.commit();

  const names = [];
  if (linkedCustomerName && !groupId) {
    names.push(linkedCustomerName);
  } else {
    for (const k of groups.keys()) {
      if (k !== '__none__') names.push(k);
    }
    for (const it of normalizedItems) {
      if (it.customerName) names.push(it.customerName);
    }
  }
  if (autoLinkLineUid && !groupId && userId) {
    try {
      await linkLineUserToCustomers(db, admin, { lineUserId: userId, customerNames: names });
    } catch (err) {
      console.warn('linkLineUserToCustomers', err.message);
    }
  }

  return groups.size;
}

module.exports = { saveLineOrders };
