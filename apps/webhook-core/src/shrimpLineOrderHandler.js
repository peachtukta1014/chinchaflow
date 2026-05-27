const {
  parseOrderItems,
  groupItemsByCustomer,
  ORDER_FORMAT_HELP,
  parseSimpleOrderLine,
  simpleToOrderItem,
  pendingToItems,
} = require('./parseLineOrder');
const {
  parseDeliveryDateFromText,
  defaultDeliveryDateKeyBangkok,
  formatDateThai,
} = require('./parseDeliveryDate');
const { getLineOrderSession, setLineOrderSession } = require('./lineOrderSession');
const { linkLineUserToCustomers } = require('./shrimpLinePush');

async function saveLineOrders(db, admin, { items, text, userId, groupId, deliveryDate }) {
  const groups = groupItemsByCustomer(items);
  const batch = db.batch();
  const ts = admin.firestore.FieldValue.serverTimestamp();

  for (const [key, groupItems] of groups) {
    const customerName = key === '__none__' ? null : key;
    const ref = db.collection('lineOrders').doc();
    batch.set(ref, {
      source: 'line',
      lineUserId: userId,
      lineGroupId: groupId,
      rawText: text,
      items: groupItems.map((i) => ({
        product: i.product,
        qty: i.qty,
        unit: i.unit,
        customerName: i.customerName || customerName,
      })),
      deliveryDate,
      customerName,
      status: 'pending',
      createdAt: ts,
    });
  }
  await batch.commit();

  const names = [...groups.keys()]
    .filter((k) => k !== '__none__')
    .map((k) => k);
  for (const it of items) {
    if (it.customerName) names.push(it.customerName);
  }
  if (!groupId) {
    try {
      await linkLineUserToCustomers(db, admin, { lineUserId: userId, customerNames: names });
    } catch (err) {
      console.warn('linkLineUserToCustomers', err.message);
    }
  }

  return groups.size;
}

function formatItemsSummary(items) {
  return items
    .map((i) => {
      const who = i.customerName ? `${i.customerName} · ` : '';
      return `• ${who}${i.product} ${i.qty} ${i.unit}`;
    })
    .join('\n');
}

/**
 * @returns {Promise<{ ok: boolean, reply: string }>}
 */
async function processShrimpLineOrder(db, admin, { text, userId, groupId }) {
  const ts = admin.firestore.FieldValue.serverTimestamp();
  const session = await getLineOrderSession(db, groupId, userId);
  const { dateKey: parsedDate, textWithoutDate } = parseDeliveryDateFromText(text);
  const body = (textWithoutDate || text).trim();

  let deliveryDate = parsedDate || session.deliveryDate || defaultDeliveryDateKeyBangkok();

  if (parsedDate) {
    await setLineOrderSession(db, session.id, { deliveryDate: parsedDate }, ts);
    deliveryDate = parsedDate;
  }

  if (parsedDate && !body) {
    return {
      ok: true,
      reply: `📅 ตั้งวันส่ง ${formatDateThai(deliveryDate)} (${deliveryDate})\nพิมพ์ชื่อลูกค้า น้ำหนัก หรือ ใหญ่/กลาง/เล็ก ได้เลยครับ`,
    };
  }

  let items = parseOrderItems(body || text);
  const simple = parseSimpleOrderLine(body);

  if (simple?.kind === 'size_only' && session.pending) {
    items = pendingToItems(session.pending, simple.product);
    await setLineOrderSession(db, session.id, { pending: null }, ts);
  } else if (simple?.kind === 'item') {
    const it = simpleToOrderItem(simple);
    if (it) items = [it];
  } else if (simple?.kind === 'pending') {
    await setLineOrderSession(
      db,
      session.id,
      {
        deliveryDate,
        pending: {
          customerName: simple.customerName,
          qty: simple.qty,
          unit: simple.unit || 'กก',
        },
      },
      ts,
    );
    return {
      ok: true,
      reply: `📝 รับ ${simple.customerName} ${simple.qty} ${simple.unit || 'กก'}\nส่ง ${formatDateThai(deliveryDate)} — พิมพ์ ใหญ่ / กลาง / เล็ก ต่อได้ครับ`,
    };
  }

  if (items.length === 0) {
    if (simple?.kind === 'size_only') {
      return {
        ok: false,
        reply: 'พิมพ์ชื่อลูกค้าและน้ำหนักก่อน แล้วค่อยส่ง กลาง/ใหญ่/เล็ก ครับ',
      };
    }
    return { ok: false, reply: `ยังอ่านรายการไม่ได้ครับ\n\n${ORDER_FORMAT_HELP}` };
  }

  const orderCount = await saveLineOrders(db, admin, {
    items,
    text,
    userId,
    groupId,
    deliveryDate,
  });

  await setLineOrderSession(db, session.id, { deliveryDate, pending: null }, ts);

  const summary = formatItemsSummary(items);
  return {
    ok: true,
    reply: `✅ รับออเดอร์แล้วครับ (${orderCount} ราย)\n📅 ส่ง ${formatDateThai(deliveryDate)} (${deliveryDate})\n\n${summary}`,
  };
}

module.exports = { processShrimpLineOrder };
