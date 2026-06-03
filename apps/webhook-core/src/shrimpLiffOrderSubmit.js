const { defaultDeliveryDateKeyBangkok } = require('./parseDeliveryDate');
const { getShrimpLineDeliveryWindow } = require('./shrimpLineConfig');
const {
  LINE_CONTACT_ROLE_BILLING,
  appendLineContact,
  customerHasLineUserId,
  legacyLineUserIdFromContacts,
  normalizeLineContacts,
} = require('./lineCustomerContacts');
const { saveLineOrders } = require('./saveShrimpLineOrders');
const { verifyLineLiffIdToken } = require('./verifyLineLiffToken');
const { normalizeLineUserId } = require('./shrimpLinePush');
const { getOrderWeightIssue } = require('./orderWeight');
const { formatItemsSummary, deliveryLabelForLang } = require('./shrimpLineReply');
const {
  findCustomerByLineUserId,
  findCustomerByName,
  upsertCustomerProfile,
  MAIN_CATALOG_SHOP_IDS,
} = require('./shrimpLineCustomerProfile');

const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push';

const PRODUCT_BY_SIZE = {
  small: 'กุ้งเล็ก',
  medium: 'กุ้งกลาง',
  large: 'กุ้งใหญ่',
  dead_small: 'กุ้งตาย ไซซ์เล็ก',
  dead_medium: 'กุ้งตาย ไซซ์กลาง',
  dead_large: 'กุ้งตาย ไซซ์ใหญ่',
  dead: 'กุ้งตาย',
};

function formatLiffRawText({ customerName, items, deliveryDate }) {
  const parts = items.map((i) => `${i.product} ${i.qty} ${i.unit}`);
  return `LIFF: ${customerName} · ${parts.join(', ')} · ส่ง ${deliveryDate}`;
}

function buildItemsFromPayload(river = {}) {
  const items = [];
  for (const [key, product] of Object.entries(PRODUCT_BY_SIZE)) {
    const raw = String(river[key] ?? '').trim();
    if (!raw) continue;
    const qty = parseFloat(raw);
    const issue = getOrderWeightIssue(qty, 'กก');
    if (issue) {
      const err = new Error(`invalid_weight_${key}`);
      err.code = 'invalid_weight';
      err.field = key;
      throw err;
    }
    items.push({
      product,
      qty,
      unit: 'กก',
      customerName: null,
    });
  }
  return items;
}

async function releaseLineUserIdFromOthers(db, admin, lineUserId, keepCustomerId) {
  const uid = normalizeLineUserId(lineUserId);
  if (!uid || !keepCustomerId) return;

  const MAIN = new Set(Array.from({ length: 27 }, (_, i) => `c${i + 1}`));
  const snap = await db.collection('customers').get();
  const batch = db.batch();
  let touched = false;
  const ts = admin.firestore.FieldValue.serverTimestamp();

  for (const doc of snap.docs) {
    if (doc.id === keepCustomerId) continue;
    if (MAIN.has(doc.id) && MAIN.has(keepCustomerId)) continue;
    const data = doc.data() || {};
    if (!customerHasLineUserId(data, uid)) continue;
    const next = normalizeLineContacts(data).filter((c) => c.uid !== uid);
    batch.set(doc.ref, {
      lineContacts: next,
      lineUserId: legacyLineUserIdFromContacts(next),
      updatedAt: ts,
    }, { merge: true });
    touched = true;
  }

  const keepRef = db.collection('customers').doc(keepCustomerId);
  const keepSnap = await keepRef.get();
  const keepData = keepSnap.data() || {};
  const contacts = customerHasLineUserId(keepData, uid)
    ? normalizeLineContacts(keepData)
    : appendLineContact(normalizeLineContacts(keepData), uid, LINE_CONTACT_ROLE_BILLING);
  batch.set(keepRef, {
    lineContacts: contacts,
    lineUserId: legacyLineUserIdFromContacts(contacts),
    lineUserIdLinkedAt: ts,
    updatedAt: ts,
  }, { merge: true });
  touched = true;

  if (touched) await batch.commit();
}

async function resolveCustomerForLiff(db, admin, {
  lineUserId,
  customerId,
  customerName,
  registerNew,
  phone,
  notes,
}) {
  const uid = normalizeLineUserId(lineUserId);
  let customer = null;

  if (customerId && MAIN_CATALOG_SHOP_IDS.has(customerId)) {
    const snap = await db.collection('customers').doc(customerId).get();
    if (snap.exists) customer = { id: snap.id, ...snap.data() };
  }

  if (!customer && uid) {
    customer = await findCustomerByLineUserId(db, uid);
  }

  const wantName = String(customerName || '').trim();
  if (!customer && wantName) {
    customer = await findCustomerByName(db, wantName);
  }

  if (!customer && registerNew && wantName) {
    customer = await upsertCustomerProfile(db, admin, {
      customer: null,
      lineUserId: uid,
      customerName: wantName,
      fields: { name: wantName, phone, notes },
    });
  }

  if (!customer && customerId) {
    const err = new Error('customer_not_found');
    err.code = 'customer_not_found';
    throw err;
  }

  if (!customer) {
    const err = new Error('customer_required');
    err.code = 'customer_required';
    throw err;
  }

  return customer;
}

async function linePushText(to, text, token) {
  if (!token || !to) return { ok: false };
  const r = await fetch(LINE_PUSH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      to,
      messages: [{ type: 'text', text: String(text).slice(0, 4800) }],
    }),
  });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    console.warn('linePushText', r.status, body);
  }
  return { ok: r.ok, status: r.status };
}

async function getLiffContext(db, lineUserId) {
  const uid = normalizeLineUserId(lineUserId);
  if (!uid) {
    const err = new Error('invalid_line_user');
    err.code = 'invalid_line_user';
    throw err;
  }

  const linked = await findCustomerByLineUserId(db, uid);
  if (linked?.id && linked?.name) {
    return {
      mode: 'short',
      customer: {
        id: linked.id,
        name: linked.name,
        zone: linked.zone || '',
      },
    };
  }

  return { mode: 'pick', customer: null };
}

async function submitLiffOrder(db, admin, body, verified) {
  const lineUserId = verified.lineUserId;
  const rawDelivery = String(body.deliveryDate || '').trim();
  let deliveryDate = rawDelivery;
  if (!deliveryDate) {
    const window = await getShrimpLineDeliveryWindow(db);
    deliveryDate = defaultDeliveryDateKeyBangkok(new Date(), window);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate)) {
    const err = new Error('invalid_delivery_date');
    err.code = 'invalid_delivery_date';
    throw err;
  }

  const riverItems = buildItemsFromPayload(body.river || {});
  if (riverItems.length === 0) {
    const err = new Error('empty_order');
    err.code = 'empty_order';
    throw err;
  }

  const registerNew = body.registerNew === true;
  const linkUid = body.linkUid !== false;

  const customer = await resolveCustomerForLiff(db, admin, {
    lineUserId,
    customerId: body.customerId,
    customerName: body.customerName,
    registerNew,
    phone: body.phone,
    notes: body.notes,
  });

  const customerName = String(customer.name || '').trim();
  const items = riverItems.map((it) => ({ ...it, customerName }));

  if (linkUid && customer.id && MAIN_CATALOG_SHOP_IDS.has(customer.id)) {
    await releaseLineUserIdFromOthers(db, admin, lineUserId, customer.id);
  }

  const rawText = formatLiffRawText({ customerName, items, deliveryDate });
  const count = await saveLineOrders(db, admin, {
    items,
    text: rawText,
    userId: lineUserId,
    groupId: null,
    deliveryDate,
    source: 'liff',
    customerId: customer.id,
    explicitCustomerName: customerName,
    autoLinkLineUid: false,
  });

  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const summary = formatItemsSummary(items, 'th');
  const deliveryLabel = deliveryLabelForLang(deliveryDate, 'th');
  const confirmText = [
    '✅ รับออเดอร์จากฟอร์มแล้วครับ',
    `👤 ${customerName}`,
    summary,
    `📅 ส่ง: ${deliveryLabel}`,
    '',
    'ร้านจะจัดเตรียมให้ครับ',
  ].join('\n');

  let pushed = false;
  if (token) {
    const push = await linePushText(lineUserId, confirmText, token);
    pushed = push.ok;
  }

  return {
    ok: true,
    orderCount: count,
    customerId: customer.id,
    customerName,
    pushed,
    message: confirmText,
  };
}

async function handleShrimpLiffOrderRequest(db, admin, body) {
  const idToken = body.idToken || body.id_token;
  const verified = await verifyLineLiffIdToken(idToken);
  const action = String(body.action || 'submit').trim();

  if (action === 'context') {
    const ctx = await getLiffContext(db, verified.lineUserId);
    return { ok: true, ...ctx, lineDisplayName: verified.name || '' };
  }

  if (action === 'submit') {
    return submitLiffOrder(db, admin, body, verified);
  }

  const err = new Error('unknown_action');
  err.code = 'unknown_action';
  throw err;
}

module.exports = {
  handleShrimpLiffOrderRequest,
  buildItemsFromPayload,
  getLiffContext,
};
