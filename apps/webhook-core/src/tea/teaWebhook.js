/** LINE Webhook — ร้านชา: บอทแจ้งสรุปปิดวัน (ไม่รับออเดอร์ลูกค้า) */
const {
  todayBKK,
  buildSummaryForDate,
  buildRestockPurchaseForDate,
  getTeaLineConfig,
  classifyTeaLineCommand,
  HELP_TEXT,
} = require('./teaDailySummary');
const { lineReply } = require('../shared/lineUtils');
const { claimLineEvent, completeLineEvent, releaseLineEvent } = require('../shared/webhookDedup');

async function handleTeaLineWebhook(db, admin, req, res) {
  if (req.method === 'GET') { res.status(200).send('ok'); return; }
  if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }

  const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body));
  const signature = req.headers['x-line-signature'] || '';
  const token = process.env.LINE_TEA_CHANNEL_ACCESS_TOKEN;

  const crypto = require('crypto');
  const secret = process.env.LINE_TEA_CHANNEL_SECRET;
  if (!secret) { res.status(401).send('Invalid signature'); return; }
  const hash = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  if (hash !== signature) { res.status(401).send('Invalid signature'); return; }

  const events = req.body.events || [];

  for (const event of events) {
    if (event.type !== 'message' || event.message.type !== 'text') continue;
    if (event.deliveryContext?.isRedelivery) continue;
    if (!(await claimLineEvent(db, event))) continue;

    try {
      const text = event.message.text.trim();
      const replyToken = event.replyToken;
      const userId = event.source.userId;
      const groupId = event.source.groupId || event.source.roomId || null;

      const teaConfig = await getTeaLineConfig(db);
      const teaGroupId = (teaConfig.notifyGroupId || '').trim();
      const cmd = classifyTeaLineCommand(text);
      // teaGroupId ไม่ตรง → เงียบ (ยังบันทึก line_messages ให้ admin ดึง Group ID ได้)
      if (groupId && teaGroupId && groupId !== teaGroupId) {
        await db.collection('line_messages').add({
          userId, groupId, text,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        await completeLineEvent(db, event);
        continue;
      }

      if (cmd === 'help') {
        await lineReply(replyToken, HELP_TEXT, token);
        await completeLineEvent(db, event);
        continue;
      }

      if (cmd === 'summary') {
        const dateKey = todayBKK();
        try {
          const summary = await buildSummaryForDate(db, dateKey);
          await lineReply(replyToken, summary, token);
        } catch (err) {
          console.error('tea summary reply', err);
          await lineReply(replyToken, '⚠️ ดึงสรุปไม่สำเร็จ ลองใหม่หรือตรวจสอบข้อมูลในแอป', token);
        }
        await completeLineEvent(db, event);
        continue;
      }

      if (cmd === 'restock') {
        const dateKey = todayBKK();
        try {
          const msg = await buildRestockPurchaseForDate(db, dateKey);
          await lineReply(replyToken, msg, token);
        } catch (err) {
          console.error('tea restock reply', err);
          await lineReply(replyToken, '⚠️ ดึงรายการซื้อเข้าร้านไม่สำเร็จ ลองใหม่ครับ', token);
        }
        await completeLineEvent(db, event);
        continue;
      }

      if (cmd === 'add_uid') {
        if (!userId) {
          await lineReply(replyToken, '⚠️ ไม่พบ User ID ของคุณในข้อความนี้', token);
          await completeLineEvent(db, event);
          continue;
        }
        try {
          const cfg = await getTeaLineConfig(db);
          const existing = cfg.notifyUserIds;
          const currentIds = Array.isArray(existing)
            ? existing.map((id) => String(id).trim()).filter(Boolean)
            : typeof existing === 'string'
              ? existing.split(/[,;\s]+/).map((id) => id.trim()).filter(Boolean)
              : [];
          if (currentIds.includes(userId)) {
            await lineReply(replyToken, `✅ UID ของคุณมีอยู่แล้วในรายชื่อรับสรุป\n(${userId})`, token);
          } else {
            const nextIds = [...currentIds, userId];
            await db.collection('config').doc('teaLine').set(
              { notifyUserIds: nextIds },
              { merge: true },
            );
            await lineReply(replyToken, `✅ เพิ่ม UID ของคุณแล้ว จะได้รับสรุปส่วนตัวด้วย\n(${userId})`, token);
          }
        } catch (err) {
          console.error('tea add_uid', err);
          await lineReply(replyToken, '⚠️ เพิ่ม UID ไม่สำเร็จ ลองใหม่ครับ', token);
        }
        await completeLineEvent(db, event);
        continue;
      }

      await db.collection('line_messages').add({
        userId, groupId, text,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await completeLineEvent(db, event);
    } catch (err) {
      await releaseLineEvent(db, event);
      throw err;
    }
  }

  res.status(200).json({ status: 'ok' });
}

module.exports = { handleTeaLineWebhook };
