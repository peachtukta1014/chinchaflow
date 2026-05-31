const {
  parseOrderItems,
  parseSimpleOrderLine,
  parseRiverPrawnPendingLine,
  simpleToOrderItem,
  pendingToItems,
  groupItemsByCustomer,
} = require('./parseLineOrder');
const {
  formatDateThai,
  resolveLineOrderDeliveryDate,
} = require('./parseDeliveryDate');
const { getLineOrderSession, setLineOrderSession } = require('./lineOrderSession');
const { linkLineUserToCustomers, findCustomerNameByLineUserId } = require('./shrimpLinePush');
const {
  assessLineCustomerProfile,
  parseProfileFields,
  upsertCustomerProfile,
  isProfileComplete,
  isNewCustomerProfileGateActive,
} = require('./shrimpLineCustomerProfile');
const { prepareOrderInput } = require('./prepareOrderInput');
const {
  replyOrderOk,
  replyParseFail,
  replyDeliverySet,
  replySimplePending,
  replySizeOnlyFirst,
  replyRiverPrompt,
  replyMissingProfile,
  formatItemsSummary,
  deliveryLabelForLang,
  replyInvalidWeight,
} = require('./shrimpLineReply');
const { getOrderWeightIssue } = require('./orderWeight');

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

function primaryCustomerNameFromItems(items) {
  for (const it of items) {
    if (it.customerName) return it.customerName;
  }
  return null;
}

async function shouldVerifyCustomerProfile(db, groupId) {
  if (groupId) return false;
  return isNewCustomerProfileGateActive(db);
}

async function tryCompleteOrder(db, admin, session, ts, ctx) {
  const { items, text, userId, groupId, deliveryDate, replyLang } = ctx;
  const summary = formatItemsSummary(items, replyLang);

  if (await shouldVerifyCustomerProfile(db, groupId)) {
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
          replyLang,
          pending: null,
          orderDraft: { items, text, userId, groupId, deliveryDate, replyLang },
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
        reply: replyMissingProfile(replyLang, missing, {
          itemsSummary: summary,
          deliveryDateLabel: deliveryLabelForLang(deliveryDate, replyLang),
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
    { deliveryDate, replyLang, pending: null, orderDraft: null, profileCollect: null },
    ts,
  );

  return {
    ok: true,
    reply: replyOrderOk(replyLang, orderCount, deliveryDate, items),
  };
}

async function handleProfileCollect(db, admin, session, ts, { text, userId, groupId, body, replyLang }) {
  const draft = session.orderDraft;
  const collect = session.profileCollect;
  const lang = replyLang || session.replyLang || 'th';

  if (!draft?.items?.length || !collect?.missing?.length) {
    await setLineOrderSession(db, session.id, { orderDraft: null, profileCollect: null }, ts);
    return { ok: false, reply: replyParseFail(lang) };
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
        replyLang: lang,
      },
      ts,
    );
    return {
      ok: true,
      reply: replyMissingProfile(lang, stillMissing, {
        itemsSummary: formatItemsSummary(draft.items, lang),
        deliveryDateLabel: deliveryLabelForLang(draft.deliveryDate, lang),
      }),
    };
  }

  if (!isProfileComplete(saved)) {
    return {
      ok: true,
      reply: replyMissingProfile(lang, ['name', 'phone', 'notes'], {
        itemsSummary: formatItemsSummary(draft.items, lang),
        deliveryDateLabel: deliveryLabelForLang(draft.deliveryDate, lang),
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
    replyLang: draft.replyLang || lang,
  });
}

/**
 * @returns {Promise<{ ok: boolean, reply: string }>}
 */
async function processShrimpLineOrder(db, admin, { text, userId, groupId }) {
  const ts = admin.firestore.FieldValue.serverTimestamp();
  const session = await getLineOrderSession(db, groupId, userId);
  const prep = prepareOrderInput(text, session);
  const replyLang = prep.replyLang;
  const body = prep.body;
  const parsedDate = prep.parsedDate;

  if (session.profileCollect && session.orderDraft) {
    return handleProfileCollect(db, admin, session, ts, {
      text,
      userId,
      groupId,
      body,
      replyLang: session.replyLang || replyLang,
    });
  }

  const lockSessionDate = Boolean(session.pending);
  let deliveryDate = resolveLineOrderDeliveryDate({
    parsedDate,
    sessionDate: session.deliveryDate,
    lockSessionDate,
  });

  if (parsedDate) {
    await setLineOrderSession(db, session.id, { deliveryDate: parsedDate, replyLang }, ts);
    deliveryDate = parsedDate;
  }

  if (parsedDate && !body) {
    return {
      ok: true,
      reply: replyDeliverySet(replyLang, deliveryDate),
    };
  }

  const riverPending = parseRiverPrawnPendingLine(body);
  let items = parseOrderItems(body);
  const simple = parseSimpleOrderLine(body);

  if (simple?.kind === 'invalid_weight') {
    return {
      ok: false,
      reply: replyInvalidWeight(replyLang, simple.qty, simple.unit),
    };
  }
  if (riverPending?.kind === 'invalid_weight') {
    return {
      ok: false,
      reply: replyInvalidWeight(replyLang, riverPending.qty, riverPending.unit),
    };
  }

  if (simple?.kind === 'size_only' && session.pending) {
    const pendingIssue = getOrderWeightIssue(
      session.pending.qty,
      session.pending.unit || 'กก',
    );
    if (pendingIssue) {
      return {
        ok: false,
        reply: replyInvalidWeight(replyLang, session.pending.qty, session.pending.unit || 'กก'),
      };
    }
    items = pendingToItems(session.pending, simple.product);
    await setLineOrderSession(db, session.id, { pending: null, replyLang }, ts);
  } else if (simple?.kind === 'item') {
    const it = simpleToOrderItem(simple);
    if (it) items = [it];
  } else if (riverPending?.kind === 'pending_river' && items.length === 0) {
    await setLineOrderSession(
      db,
      session.id,
      {
        deliveryDate,
        replyLang,
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
      reply: replyRiverPrompt(replyLang, riverPending, deliveryDate),
    };
  } else if (simple?.kind === 'pending') {
    await setLineOrderSession(
      db,
      session.id,
      {
        deliveryDate,
        replyLang,
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
      reply: replySimplePending(
        replyLang,
        simple.customerName,
        simple.qty,
        simple.unit || 'กก',
        deliveryDate,
      ),
    };
  }

  if (items.length === 0) {
    if (simple?.kind === 'size_only') {
      return {
        ok: false,
        reply: replySizeOnlyFirst(replyLang),
      };
    }
    if (riverPending) {
      return {
        ok: true,
        reply: replyRiverPrompt(replyLang, riverPending, deliveryDate),
      };
    }
    return { ok: false, reply: replyParseFail(replyLang) };
  }

  return tryCompleteOrder(db, admin, session, ts, {
    items,
    text: prep.raw,
    userId,
    groupId,
    deliveryDate,
    replyLang,
  });
}

module.exports = { processShrimpLineOrder };
