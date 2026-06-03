const {
  findCustomerByLineUserId,
  findCustomerByName,
} = require('./shrimpLineCustomerProfile');
const {
  findCustomerNameByLineUserId,
  linkLineUserToCustomers,
} = require('./shrimpLinePush');
const { isStaffLineUserId } = require('./shrimpStaffLineUids');
const { setLineOrderSession } = require('./lineOrderSession');
const { registerPendingLinkRequest, clearPendingLinkRequest } = require('./shrimpLinePendingLink');
const {
  LINE_CONTACT_ROLE_BILLING,
  getBillingLineUserId,
  normalizeLineContacts,
} = require('./lineCustomerContacts');

/** ลูกค้าเก่าผูก LINE UID กับร้านในระบบ */
const LINK_CUSTOMER_CMD = /^(ผูกไอดีลูกค้า|ผูกไอดี|ลูกค้าเก่าผูก)(\s+|$)/i;

function isLinkCustomerCommand(text) {
  return LINK_CUSTOMER_CMD.test(String(text || '').trim());
}

/** ชื่อร้านหลังคำสั่ง (ถ้ามี) — เช่น 「ผูกไอดีลูกค้า ตาจุ้ย」 */
function parseLinkCustomerShopName(text) {
  const raw = String(text || '').trim();
  const m = raw.match(LINK_CUSTOMER_CMD);
  if (!m) return null;
  const rest = raw.slice(m[0].length).trim();
  return rest;
}

function replyLinkNeedDirectChat() {
  return (
    'ผูกไอดีลูกค้า ใช้ในแชตตรงกับร้าน (LINE OA) เท่านั้นครับ\n'
    + 'ในกลุ่มให้แอดมินผูกจากแอปกุ้งได้'
  );
}

function replyLinkStaff() {
  return 'บัญชีนี้เป็นสมาชิกแอปร้าน — ไม่ต้องผูกเป็นลูกค้าครับ';
}

function replyLinkAlreadyLinked(name) {
  return `✅ LINE นี้ผูกกับ「${name}」อยู่แล้ว — สั่งได้เลยครับ`;
}

function replyLinkWaitAdmin() {
  return (
    '✅ รับคำขอผูก LINE แล้วครับ\n\n'
    + 'แอดมินจะจับคู่ร้านให้ในแอป — ไม่ต้องสั่งอาหารก่อน\n'
    + 'ไม่ต้องพิมพ์ชื่อร้าน เพียงรอแจ้งจากร้าน'
  );
}

function replyLinkSuccess(customer, role) {
  const roleLabel = role === LINE_CONTACT_ROLE_BILLING ? 'เจ้าของ/โอน' : 'คนสั่งใน LINE';
  const zone = customer.zone ? ` (${customer.zone})` : '';
  return (
    `✅ ผูก LINE กับ「${customer.name}」${zone} แล้ว\n`
    + `บทบาท: ${roleLabel}\n`
    + 'สั่งผ่านแชตนี้ได้เลยครับ'
  );
}

function replyLinkNotFound(shopName) {
  return (
    `ไม่พบร้าน「${shopName}」ในระบบ\n\n`
    + 'ลองพิมพ์ชื่อให้ตรงรายชื่อหลัก หรือติดต่อร้านให้แอดมินผูกให้'
  );
}

async function performLinkCustomer(db, admin, userId, shopName) {
  const name = String(shopName || '').trim();
  if (!name) {
    await registerPendingLinkRequest(db, admin, userId);
    return { reply: replyLinkWaitAdmin() };
  }

  const existing = await findCustomerByLineUserId(db, userId);
  if (existing?.name) {
    return { reply: replyLinkAlreadyLinked(existing.name) };
  }

  const customer = await findCustomerByName(db, name);
  if (!customer) {
    return { reply: replyLinkNotFound(name) };
  }

  const contacts = normalizeLineContacts(customer);
  const hasBilling = !!getBillingLineUserId(customer);
  const role = hasBilling ? 'order' : LINE_CONTACT_ROLE_BILLING;

  await linkLineUserToCustomers(db, admin, {
    lineUserId: userId,
    customerNames: [customer.name],
  });

  const linkedName = await findCustomerNameByLineUserId(db, userId);
  if (!linkedName) {
    return {
      reply: 'ผูกไม่สำเร็จ — ลองอีกครั้งหรือให้แอดมินผูกจากแอป',
    };
  }

  await clearPendingLinkRequest(db, admin, userId);
  return { reply: replyLinkSuccess(customer, role) };
}

/**
 * @returns {Promise<{ reply: string }>}
 */
async function processShrimpLinkCustomer(db, admin, {
  text,
  userId,
  groupId,
  session,
  serverTimestamp,
}) {
  if (groupId) {
    return { reply: replyLinkNeedDirectChat() };
  }

  if (await isStaffLineUserId(db, userId)) {
    return { reply: replyLinkStaff() };
  }

  const inlineName = parseLinkCustomerShopName(text);
  if (inlineName) {
    await setLineOrderSession(
      db,
      session.id,
      { customerLink: null },
      serverTimestamp,
    );
    return performLinkCustomer(db, admin, userId, inlineName);
  }

  if (session.customerLink?.step === 'shop_name') {
    await setLineOrderSession(
      db,
      session.id,
      { customerLink: null },
      serverTimestamp,
    );
    await registerPendingLinkRequest(db, admin, userId);
    const existing = await findCustomerByLineUserId(db, userId);
    if (existing?.name) {
      return { reply: replyLinkAlreadyLinked(existing.name) };
    }
    return { reply: replyLinkWaitAdmin() };
  }

  if (isLinkCustomerCommand(text)) {
    await setLineOrderSession(
      db,
      session.id,
      { customerLink: null },
      serverTimestamp,
    );
    const existing = await findCustomerByLineUserId(db, userId);
    if (existing?.name) {
      return { reply: replyLinkAlreadyLinked(existing.name) };
    }
    await registerPendingLinkRequest(db, admin, userId);
    return { reply: replyLinkWaitAdmin() };
  }

  return { reply: replyLinkWaitAdmin() };
}

module.exports = {
  LINK_CUSTOMER_CMD,
  isLinkCustomerCommand,
  parseLinkCustomerShopName,
  processShrimpLinkCustomer,
};
