const { todayBKK, lineReply } = require('./teaDailySummary');
const { classifyShrimpLineMessage } = require('./shrimpLineIntent');
const { processShrimpLineOrder } = require('./shrimpLineOrderHandler');
const { getLineOrderSession } = require('./lineOrderSession');
const { buildShrimpSummaryForDate } = require('./shrimpDailySummary');
const { isShrimpGroupChat } = require('./shrimpGroupKeyboard');
const { buildShrimpTodayOrdersSummary } = require('./shrimpTodayOrdersSummary');
const { processShrimpPaymentSlipImage } = require('./shrimpPaymentSlip');

const GROUP_ALLOWED_TEXT_INTENTS = new Set(['summary', 'today_orders', 'order']);

async function logShrimpGroupText(db, admin, { event, text, groupId }) {
  const ts = admin.firestore.FieldValue.serverTimestamp();
  db.collection('line_messages').add({
    userId: event.source?.userId || null,
    groupId,
    text,
    source: 'shrimp',
    createdAt: ts,
  }).catch((e) => console.warn('line_messages log', e));
  return ts;
}

async function handleShrimpGroupTextEvent(db, admin, { event, token, context }) {
  const text = event.message.text.trim();
  const userId = event.source?.userId || null;
  const groupId = context.chatId;
  const replyToken = event.replyToken;
  await logShrimpGroupText(db, admin, { event, text, groupId });

  const session = await getLineOrderSession(db, groupId, userId);
  const intent = classifyShrimpLineMessage(text, session, { groupId });
  if (!GROUP_ALLOWED_TEXT_INTENTS.has(intent)) {
    return { skipped: 'ignored_group_text' };
  }

  if (intent === 'summary') {
    try {
      const dateKey = todayBKK();
      const summary = await buildShrimpSummaryForDate(db, dateKey, {
        familyGroup: isShrimpGroupChat(groupId),
      });
      await lineReply(replyToken, summary, token);
    } catch (err) {
      console.error('shrimp summary', err);
      await lineReply(replyToken, '⚠️ ดึงสรุปไม่สำเร็จ ลองใหม่ครับ', token);
    }
    return { ok: true, handled: 'summary' };
  }

  if (intent === 'today_orders') {
    try {
      const dateKey = todayBKK();
      const summary = await buildShrimpTodayOrdersSummary(db, dateKey, {
        familyGroup: isShrimpGroupChat(groupId),
      });
      await lineReply(replyToken, summary, token);
    } catch (err) {
      console.error('shrimp today orders', err);
      await lineReply(replyToken, '⚠️ ดึงรายการออเดอร์ไม่สำเร็จ ลองใหม่ครับ', token);
    }
    return { ok: true, handled: 'today_orders' };
  }

  const result = await processShrimpLineOrder(db, admin, { text, userId, groupId });
  await lineReply(replyToken, result.reply, token);
  return { ok: true, handled: 'order' };
}

async function handleShrimpGroupLineEvent(db, admin, { event, token, context }) {
  if (event.type !== 'message') return { skipped: 'unsupported_group_event' };

  if (event.message?.type === 'image') {
    return processShrimpPaymentSlipImage(db, admin, {
      event,
      token,
      allowGroup: Boolean(context.chatId && isShrimpGroupChat(context.chatId)),
    });
  }

  if (event.message?.type !== 'text') return { skipped: 'unsupported_group_message' };
  return handleShrimpGroupTextEvent(db, admin, { event, token, context });
}

module.exports = {
  GROUP_ALLOWED_TEXT_INTENTS,
  handleShrimpGroupLineEvent,
};
