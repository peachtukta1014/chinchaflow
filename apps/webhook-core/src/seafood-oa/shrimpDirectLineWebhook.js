const { todayBKK, lineReply } = require('../shared/lineUtils');
const { classifyShrimpLineMessage } = require('./shrimpLineIntent');
const { processShrimpLineOrder } = require('./shrimpLineOrderHandler');
const { processShrimpLinkCustomer } = require('./shrimpLineCustomerLink');
const { getLineOrderSession, clearSessionForCancel } = require('./lineOrderSession');
const { detectMessageLang } = require('./orderMessageLang');
const { replyHelpCustomerThai, replyHelpCustomerEnglish, replyCancelFail } = require('./shrimpLineReply');
const { cancelLatestPendingOrderForUser } = require('./shrimpTodayOrdersSummary');
const { processShrimpPaymentSlipImage } = require('./shrimpPaymentSlip');
const {
  getShrimpLiffId,
  buildLiffOrderFlex,
  buildLiffWelcomeFlex,
  replyLiffNotReadyText,
  lineReplyMessages,
} = require('./shrimpLiffMessaging');

async function replyShrimpFollowWelcome(event, token) {
  const replyToken = event.replyToken;
  if (!replyToken) return { skipped: 'missing_reply_token' };

  const liffId = getShrimpLiffId();
  if (liffId) {
    await lineReplyMessages(replyToken, buildLiffWelcomeFlex(liffId), token);
  } else {
    await lineReply(
      replyToken,
      'สวัสดีครับ 🦐 โกอ้วน คลังซีฟู้ด\nพิมพ์สั่งในแชทได้เลย หรือพิมพ์ ฟอร์ม เมื่อเปิดใช้ฟอร์มสั่งแล้ว',
      token,
    );
  }
  return { ok: true, handled: 'follow_welcome' };
}

async function logShrimpDirectText(db, admin, { event, text }) {
  const ts = admin.firestore.FieldValue.serverTimestamp();
  db.collection('line_messages').add({
    userId: event.source?.userId || null,
    groupId: null,
    text,
    source: 'shrimp',
    createdAt: ts,
  }).catch((e) => console.warn('line_messages log', e));
  return ts;
}

async function handleShrimpDirectTextEvent(db, admin, { event, token }) {
  const text = event.message.text.trim();
  const userId = event.source.userId;
  const replyToken = event.replyToken;
  const ts = await logShrimpDirectText(db, admin, { event, text });
  const session = await getLineOrderSession(db, null, userId);
  const intent = classifyShrimpLineMessage(text, session, { groupId: null });

  if (intent === 'ignore') return { skipped: 'ignored_direct_text' };

  if (intent === 'help') {
    await lineReply(replyToken, replyHelpCustomerThai(), token);
    return { ok: true, handled: 'help' };
  }

  if (intent === 'help_en') {
    await lineReply(replyToken, replyHelpCustomerEnglish(), token);
    return { ok: true, handled: 'help_en' };
  }

  if (intent === 'open_liff') {
    const lang = detectMessageLang(text);
    const liffId = getShrimpLiffId();
    if (liffId) {
      await lineReplyMessages(replyToken, [buildLiffOrderFlex(liffId)], token);
    } else {
      await lineReply(replyToken, replyLiffNotReadyText(lang), token);
    }
    return { ok: true, handled: 'open_liff' };
  }

  if (intent === 'link_customer') {
    try {
      const { reply } = await processShrimpLinkCustomer(db, admin, {
        text,
        userId,
        groupId: null,
        session,
        serverTimestamp: ts,
      });
      await lineReply(replyToken, reply, token);
    } catch (err) {
      console.error('shrimp link customer', err);
      await lineReply(replyToken, '⚠️ ผูกไอดีไม่สำเร็จ ลองใหม่หรือติดต่อร้านครับ', token);
    }
    return { ok: true, handled: 'link_customer' };
  }

  if (intent === 'cancel_order') {
    try {
      const { message } = await cancelLatestPendingOrderForUser(db, userId);
      if (session?.id) {
        clearSessionForCancel(db, session.id, admin.firestore.FieldValue.serverTimestamp())
          .catch((e) => console.warn('clearSessionForCancel', e));
      }
      await lineReply(replyToken, message, token);
    } catch (err) {
      console.error('shrimp cancel order', err);
      await lineReply(replyToken, replyCancelFail(detectMessageLang(text)), token);
    }
    return { ok: true, handled: 'cancel_order' };
  }

  const result = await processShrimpLineOrder(db, admin, { text, userId, groupId: null });
  await lineReply(replyToken, result.reply, token);
  return { ok: true, handled: 'order' };
}

async function handleShrimpDirectLineEvent(db, admin, { event, token }) {
  if (event.type === 'follow') return replyShrimpFollowWelcome(event, token);
  if (event.type !== 'message') return { skipped: 'unsupported_direct_event' };

  if (event.message?.type === 'image') {
    return processShrimpPaymentSlipImage(db, admin, {
      event,
      token,
      allowGroup: false,
    });
  }

  if (event.message?.type !== 'text') return { skipped: 'unsupported_direct_message' };
  return handleShrimpDirectTextEvent(db, admin, { event, token });
}

module.exports = {
  handleShrimpDirectLineEvent,
};
