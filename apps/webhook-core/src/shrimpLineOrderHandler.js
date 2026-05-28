const {
  parseOrderItems,
  groupItemsByCustomer,
  ORDER_FORMAT_HELP,
  parseSimpleOrderLine,
  parseRiverPrawnPendingLine,
  simpleToOrderItem,
  pendingToItems,
  formatRiverSizePrompt,
} = require('./parseLineOrder');
const {
  parseDeliveryDateFromText,
  formatDateThai,
  resolveLineOrderDeliveryDate,
} = require('./parseDeliveryDate');
const { getLineOrderSession, setLineOrderSession } = require('./lineOrderSession');
const { linkLineUserToCustomers, findCustomerNameByLineUserId } = require('./shrimpLinePush');
const {
  assessLineCustomerProfile,
  parseProfileFields,
  formatMissingProfilePrompt,
  upsertCustomerProfile,
  isProfileComplete,
} = require('./shrimpLineCustomerProfile');

async function saveLineOrders(db, admin, { items, text, userId, groupId, deliveryDate }) {
  const groups = groupItemsByCustomer(items);
  const batch = db.batch();
  const ts = admin.firestore.FieldValue.serverTimestamp();

  let linkedCustomerName = null;
  if (userId && !groupId) {
    linkedCustomerName = await findCustomerNameByLineUserId(db, userId);
  }

  for (const [key, groupItems] of groups) {
    let customerName = key === '__none__' ? null : key;
    if (!customerName && linkedCustomerName) customerName = linkedCustomerName;
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

function primaryCustomerNameFromItems(items) {
  for (const it of items) {
    if (it.customerName) return it.customerName;
  }
  return null;
}

function shouldVerifyCustomerProfile(groupId) {
  return !groupId;
}

async function tryCompleteOrder(db, admin, session, ts, ctx) {
  const { items, text, userId, groupId, deliveryDate } = ctx;
  const deliveryLabel = `${formatDateThai(deliveryDate)} (${deliveryDate})`;
  const summary = formatItemsSummary(items);

  if (shouldVerifyCustomerProfile(groupId)) {
    const customerName = primaryCustomerNameFromItems(items)
      || (await findCustomerNameByLineUserId(db, userId));
    const { customer, missing } = await assessLineCustomerProfile(db, {
      lineUserId: userId,
      customerName,
      groupId,
    });

    if (missing.length > 0) {
      await setLineOrderSession(
        db,
        session.id,
        {
          deliveryDate,
          pending: null,
          orderDraft: { items, text, userId, groupId, deliveryDate },
          profileCollect: {
            missing,
            customerId: customer?.id || null,
            customerName: customer?.name || customerName || null,
          },
        },
        ts,
      );
      return {
        ok: true,
        reply: formatMissingProfilePrompt(missing, {
          itemsSummary: summary,
          deliveryDateLabel: deliveryLabel,
        }),
      };
    }
  }

  const orderCount = await saveLineOrders(db, admin, {
    items,
    text,
    userId,
    groupId,
    deliveryDate,
  });

  await setLineOrderSession(
    db,
    session.id,
    { deliveryDate, pending: null, orderDraft: null, profileCollect: null },
    ts,
  );

  return {
    ok: true,
    reply: `✅ รับออเดอร์แล้วครับ (${orderCount} ราย)\n📅 ส่ง ${deliveryLabel}\n\n${summary}`,
  };
}

async function handleProfileCollect(db, admin, session, ts, { text, userId, groupId, body }) {
  const draft = session.orderDraft;
  const collect = session.profileCollect;
  if (!draft?.items?.length || !collect?.missing?.length) {
    await setLineOrderSession(db, session.id, { orderDraft: null, profileCollect: null }, ts);
    return { ok: false, reply: `ยังอ่านรายการไม่ได้ครับ\n\n${ORDER_FORMAT_HELP}` };
  }

  const parsed = parseProfileFields(body || text);
  const merged = {
    name: parsed.name || collect.customerName || '',
    phone: parsed.phone || '',
    notes: parsed.notes || '',
  };

  let customer = null;
  if (collect.customerId) {
    const snap = await db.collection('customers').doc(collect.customerId).get();
    if (snap.exists) customer = { id: snap.id, ...snap.data() };
  }

  const saved = await upsertCustomerProfile(db, admin, {
    customer,
    lineUserId: userId,
    customerName: merged.name || collect.customerName,
    fields: {
      name: merged.name || customer?.name,
      phone: merged.phone || customer?.phone,
      notes: merged.notes || customer?.notes,
    },
  });

  const stillMissing = collect.missing.filter((key) => {
    if (key === 'name') return !String(saved.name || '').trim();
    if (key === 'phone') return !String(saved.phone || '').trim();
    if (key === 'notes') return !String(saved.notes || '').trim();
    return true;
  });

  if (stillMissing.length > 0) {
    await setLineOrderSession(
      db,
      session.id,
      {
        profileCollect: {
          ...collect,
          customerId: saved.id,
          customerName: saved.name,
          missing: stillMissing,
        },
      },
      ts,
    );
    return {
      ok: true,
      reply: formatMissingProfilePrompt(stillMissing, {
        itemsSummary: formatItemsSummary(draft.items),
        deliveryDateLabel: `${formatDateThai(draft.deliveryDate)} (${draft.deliveryDate})`,
      }),
    };
  }

  if (!isProfileComplete(saved)) {
    return {
      ok: true,
      reply: formatMissingProfilePrompt(['name', 'phone', 'notes'], {
        itemsSummary: formatItemsSummary(draft.items),
        deliveryDateLabel: `${formatDateThai(draft.deliveryDate)} (${draft.deliveryDate})`,
      }),
    };
  }

  await setLineOrderSession(db, session.id, { profileCollect: null, orderDraft: null }, ts);
  return tryCompleteOrder(db, admin, session, ts, {
    items: draft.items,
    text: draft.text || text,
    userId: draft.userId || userId,
    groupId: draft.groupId || groupId,
    deliveryDate: draft.deliveryDate,
  });
}

/**
 * @returns {Promise<{ ok: boolean, reply: string }>}
 */
async function processShrimpLineOrder(db, admin, { text, userId, groupId }) {
  const ts = admin.firestore.FieldValue.serverTimestamp();
  const session = await getLineOrderSession(db, groupId, userId);
  const { dateKey: parsedDate, textWithoutDate } = parseDeliveryDateFromText(text);
  const body = (textWithoutDate || text).trim();

  if (session.profileCollect && session.orderDraft) {
    return handleProfileCollect(db, admin, session, ts, { text, userId, groupId, body });
  }

  const lockSessionDate = Boolean(session.pending);
  let deliveryDate = resolveLineOrderDeliveryDate({
    parsedDate,
    sessionDate: session.deliveryDate,
    lockSessionDate,
  });

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

  const deliveryLabel = `${formatDateThai(deliveryDate)} (${deliveryDate})`;
  const riverPending = parseRiverPrawnPendingLine(body || text);
  let items = parseOrderItems(body || text);
  const simple = parseSimpleOrderLine(body);

  if (simple?.kind === 'size_only' && session.pending) {
    items = pendingToItems(session.pending, simple.product);
    await setLineOrderSession(db, session.id, { pending: null }, ts);
  } else if (simple?.kind === 'item') {
    const it = simpleToOrderItem(simple);
    if (it) items = [it];
  } else if (riverPending?.kind === 'pending_river') {
    await setLineOrderSession(
      db,
      session.id,
      {
        deliveryDate,
        pending: {
          variant: 'river_prawn',
          customerName: riverPending.customerName,
          qty: riverPending.qty,
          unit: riverPending.unit,
        },
      },
      ts,
    );
    return {
      ok: true,
      reply: formatRiverSizePrompt(riverPending, deliveryLabel),
    };
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
    if (riverPending) {
      return {
        ok: true,
        reply: formatRiverSizePrompt(riverPending, deliveryLabel),
      };
    }
    return { ok: false, reply: `ยังอ่านรายการไม่ได้ครับ\n\n${ORDER_FORMAT_HELP}` };
  }

  return tryCompleteOrder(db, admin, session, ts, {
    items,
    text,
    userId,
    groupId,
    deliveryDate,
  });
}

module.exports = { processShrimpLineOrder };
