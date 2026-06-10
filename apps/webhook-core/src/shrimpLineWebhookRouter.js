const { handleShrimpDirectLineEvent } = require('./shrimpDirectLineWebhook');
const { handleShrimpGroupLineEvent } = require('./shrimpGroupLineWebhook');

function classifyShrimpLineContext(event = {}) {
  const source = event.source || {};
  const sourceType = source.type || 'unknown';
  const groupId = source.groupId || null;
  const roomId = source.roomId || null;
  const chatId = groupId || roomId || null;

  if (sourceType === 'user' && !chatId) {
    return { kind: 'direct', sourceType, groupId: null, roomId: null, chatId: null };
  }

  if (sourceType === 'group' || sourceType === 'room' || chatId) {
    return {
      kind: 'group',
      sourceType,
      groupId,
      roomId,
      chatId,
      chatType: roomId ? 'room' : 'group',
    };
  }

  return { kind: 'unsupported', sourceType, groupId, roomId, chatId };
}

async function handleShrimpLineWebhookEvent(db, admin, { event, token }) {
  const context = classifyShrimpLineContext(event);
  if (context.kind === 'direct') {
    return handleShrimpDirectLineEvent(db, admin, { event, token, context });
  }
  if (context.kind === 'group') {
    return handleShrimpGroupLineEvent(db, admin, { event, token, context });
  }
  return { skipped: 'unsupported_line_source' };
}

module.exports = {
  classifyShrimpLineContext,
  handleShrimpLineWebhookEvent,
};
