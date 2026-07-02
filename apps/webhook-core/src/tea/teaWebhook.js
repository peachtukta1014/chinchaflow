/** LINE Webhook — ร้านชา: บอทแจ้งสรุปปิดวัน (ไม่รับออเดอร์ลูกค้า) */
const crypto = require('crypto'); //  ย้ายขึ้นมาด้านบนเพื่อลดภาระ CPU เวลาเรียกฟังก์ชัน
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

  const secret = process.env.LINE_TEA_CHANNEL_SECRET;
  if (!secret) { res.status(401).send('Invalid configuration'); return; }
  
  // คำนวณหา Signature Hash จากหลังบ้าน
  const hash = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  
  // ป้องกัน Timing Attack โดยแปลงเป็น Buffer ก่อนเปรียบเทียบแบบสมมาตรเวลา
  const hashBuffer = Buffer.from(hash);
  const sigBuffer = Buffer.from(signature);
  if (hashBuffer.length !== sigBuffer.length || !crypto.timingSafeEqual(hashBuffer, sigBuffer)) {
    res.status(401).send('Invalid signature');
    return;
  }

  const events = req.body.events || [];

  for (const event of events) {
    // รองรับ event type: message (ข้อความ), follow (เพิ่มเพื่อน/ถูกเชิญเข้ากลุ่ม)
    if (event.type !== 'message' && event.type !== 'follow') continue;
    if (event.deliveryContext?.isRedelivery) continue; // ข้ามข้อความซ้ำจากระบบ LINE
    if (!(await claimLineEvent(db, event))) continue;  // ตรวจสอบคิวป้องกันประมวลผลซ้ำชนกันเอง

    // ครอบ try/catch รายข้อความ เพื่อไม่ให้ข้อความที่พังตัวเดียว ไปทำลายทั้ง Batch ที่เหลือค๊าาา
    try {
      const replyToken = event.replyToken;
      const userId = event.source.userId;
      const groupId = event.source.groupId || event.source.roomId || null;
      const sourceType = event.source.type || 'user';

      // ── EVENT: follow (เพิ่มเพื่อน / ถูกเชิญเข้ากลุ่ม) ──
      if (event.type === 'follow') {
        const welcomeMsg = groupId
          ? '🤖 สวัสดีครับ! บอทชินชาพร้อมให้บริการในกลุ่มแล้ว\n\n'
            + 'คำสั่งที่มี:\n'
            + '• พิมพ์ "สรุป" → ดูสรุปยอดขายวันนี้\n'
            + '• พิมพ์ "ซื้อของ" → ดูรายการสั่งของวันนี้\n'
            + '• พิมพ์ "help" → ดูคำสั่งทั้งหมด\n\n'
            + '⚠️ ถ้าบอทยังไม่ตอบ: เช็กว่าแอดมินตั้งค่า Group ID ในแอป → แอดมิน → LINE Bot ตรงกับกลุ่มนี้หรือยัง'
          : '🤖 สวัสดีครับ! บอทชินชาพร้อมให้บริการแล้ว\n\nพิมพ์ "help" เพื่อดูคำสั่งทั้งหมด';
        await lineReply(replyToken, welcomeMsg, token);
        await completeLineEvent(db, event);
        continue;
      }

      // ── EVENT: message (ข้อความ) ──
      if (event.message?.type !== 'text') {
        // ข้ามข้อความที่ไม่ใช่ text (sticker, image, ฯลฯ) — แต่ยังบันทึก log
        await db.collection('line_messages').add({
          userId, groupId, sourceType,
          msgType: event.message?.type || 'unknown',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }).catch(() => {});
        await completeLineEvent(db, event);
        continue;
      }

      const text = event.message.text.trim();

      const teaConfig = await getTeaLineConfig(db);
      const teaGroupId = (teaConfig.notifyGroupId || '').trim();
      const cmd = classifyTeaLineCommand(text);
      
      // กรณีมาจากกลุ่มอื่นที่ไม่ใช่กลุ่มร้านชาหลักที่คอนฟิกไว้
      // → ตอบกลับด้วยข้อความแจ้งเตือน (ไม่เงียบแบบเดิม) และบันทึกลง Firestore
      if (groupId && teaGroupId && groupId !== teaGroupId) {
        await db.collection('line_messages').add({
          userId, groupId, text, sourceType,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        await lineReply(replyToken,
          '⚠️ บอทนี้ถูกตั้งค่าให้ทำงานกับอีกกลุ่มหนึ่ง\n'
          + 'ถ้าต้องการให้บอทตอบในกลุ่มนี้ ให้แอดมินอัปเดต Group ID ในแอป → แอดมิน → LINE Bot',
          token,
        );
        await completeLineEvent(db, event);
        continue;
      }

      // [COMMAND] คำสั่งช่วยเหลือ
      if (cmd === 'help') {
        await lineReply(replyToken, HELP_TEXT, token);
        await completeLineEvent(db, event);
        continue;
      }

      // [COMMAND] สรุปยอดขายรายวันชินชา
      if (cmd === 'summary') {
        const dateKey = todayBKK();
        try {
          const summary = await buildSummaryForDate(db, dateKey);
          await lineReply(replyToken, summary, token);
        } catch (err) {
          console.error('tea summary reply error:', err);
          await lineReply(replyToken, '⚠️ ดึงสรุปไม่สำเร็จ ลองใหม่หรือตรวจสอบข้อมูลในแอป', token);
        }
        await completeLineEvent(db, event);
        continue;
      }

      // [COMMAND] รายการสั่งของ/ซื้อเข้าร้าน
      if (cmd === 'restock') {
        const dateKey = todayBKK();
        try {
          const msg = await buildRestockPurchaseForDate(db, dateKey);
          await lineReply(replyToken, msg, token);
        } catch (err) {
          console.error('tea restock reply error:', err);
          await lineReply(replyToken, '⚠️ ดึงรายการซื้อเข้าร้านไม่สำเร็จ ลองใหม่ครับ', token);
        }
        await completeLineEvent(db, event);
        continue;
      }

      // [COMMAND] ลงทะเบียนรับสรุปส่วนตัวผ่าน UID
      if (cmd === 'add_uid') {
        if (!userId) {
          await lineReply(replyToken, '⚠️ 不พบ User ID ของคุณในข้อความนี้', token);
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
          console.error('tea add_uid error:', err);
          await lineReply(replyToken, '⚠️ เพิ่ม UID ไม่สำเร็จ ลองใหม่ครับ', token);
        }
        await completeLineEvent(db, event);
        continue;
      }

      // ไม่ตรงคำสั่งใด → ตอบกลับด้วยคำแนะนำสั้น ๆ (ไม่เงียบแบบเดิม)
      await db.collection('line_messages').add({
        userId, groupId, text, sourceType,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await lineReply(replyToken,
        '🤖 สวัสดีครับ! บอทชินชาพร้อมให้บริการ\n\n'
        + 'คำสั่งที่มี:\n'
        + '• "สรุป" → ดูสรุปยอดขายวันนี้\n'
        + '• "ซื้อของ" → ดูรายการสั่งของวันนี้\n'
        + '• "help" → ดูคำสั่งทั้งหมด\n'
        + '• "แอด uid" → ลงทะเบียนรับสรุปส่วนตัว',
        token,
      );
      await completeLineEvent(db, event);
      
    } catch (err) {
      // หากเกิดปัญหาเร้นลับในตัว Event นี้ ให้ทำการปล่อย Lock ตัวคิว เพื่อให้ระบบสามารถ Retry ใหม่ได้ทีหลัง
      console.error(`[Fatal Event Error] Failed processing event for token: ${event.replyToken}`, err);
      await releaseLineEvent(db, event);
      // ไม่ทำการ throw สวนออกไป เพื่อให้ลูปตัวถัดไปใน Batch ทำงานต่อได้จนสุดสายค๊าาา
    }
  }

  // ส่งกลับสเตตัส 200 ยืนยันให้ฝั่ง LINE ทราบว่าได้รับกล่องพัสดุเรียบร้อยแล้ว
  res.status(200).json({ status: 'ok' });
}

module.exports = { handleTeaLineWebhook };
