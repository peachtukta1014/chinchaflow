const { groupItemsByCustomer } = require('./parseLineOrder');
const { linkLineUserToCustomers, findCustomerNameByLineUserId } = require('../seafood-notify/shrimpLinePush');
const { isStaffLineUserId } = require('./shrimpStaffLineUids');
const { notifyShrimpLineOrdersAfterSave } = require('../seafood-notify/instantLineNotify');
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
  explicitZone = null,
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
  const created = [];

  for (const [key, groupItems] of groups) {
    const parsedName = key === '__none__' ? null : key;
    const customerName = resolveLineOrderCustomerName({
      parsedName,
      groupId,
      linkedCustomerName,
    });
    const ref = db.collection('lineOrders').doc();
    const payload = {
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
      zone: explicitZone ? String(explicitZone).trim() : null,
      status: 'pending',
    };
    batch.set(ref, { ...payload, createdAt: ts });
    created.push({ id: ref.id, ...payload });
  }
  await batch.commit();

  if (!groupId && created.length > 0) {
    try {
      const notify = await notifyShrimpLineOrdersAfterSave(db, created, { groupId });
      if (notify.sent === 0 && notify.details?.some((d) => d.skipped)) {
        console.log('saveLineOrders notify', notify.details);
      }
    } catch (err) {
      console.error('saveLineOrders notify', err);
    }
  }

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
      const staffUid = await isStaffLineUserId(db, userId);
      if (!staffUid) {
        await linkLineUserToCustomers(db, admin, { lineUserId: userId, customerNames: names });
      }
    } catch (err) {
      console.warn('linkLineUserToCustomers', err.message);
    }
  }

  return groups.size;
}

module.exports = { saveLineOrders };
