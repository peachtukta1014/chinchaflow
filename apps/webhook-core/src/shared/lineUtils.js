/** ยูทิลิตี้ LINE Messaging API ที่ใช้ร่วมกันทุก scope */

/**
 * ดึงวันที่ปัจจุบันในโซนเวลาประเทศไทย (Asia/Bangkok)
 * @returns {string} รูปแบบ YYYY-MM-DD
 */
function todayBKK() {
  return new Date(Date.now() + 7 * 3600000).toISOString().split('T')[0];
}

/**
 * แปลงตัวเลขเป็นจำนวนเงินบาทไทย พร้อมเครื่องหมายจุลภาค (Comma)
 * @param {number} n - จำนวนเงิน
 * @returns {string} ข้อความเงินบาท เช่น ฿1,500
 */
function formatMoney(n) {
  return `฿${Math.round(n || 0).toLocaleString('th-TH')}`;
}

/**
 * ส่งข้อความตรงเข้าหา User ID หรือ Group ID (Push Message)
 * @param {string} to - LINE User ID หรือ Group ID
 * @param {string} text - ข้อความที่ต้องการส่ง
 * @param {string} token - LINE Channel Access Token
 * @returns {Promise<boolean>} สเตตัสการส่งสำเร็จหรือไม่
 */
async function linePush(to, text, token) {
  if (!token || !to) return false;
  try {
    const r = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to, messages: [{ type: 'text', text }] }),
    });
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      console.error('linePush failed', r.status, to, body.slice(0, 300));
    }
    return r.ok;
  } catch (err) {
    console.error('linePush error', to, err.message);
    return false;
  }
}

/**
 * ตอบกลับข้อความทันทีโดยใช้ Reply Token (มีระบบ Log ตัวดักจับเมื่อ Token หมดอายุ)
 * @param {string} replyToken - Reply Token ที่ได้จาก Webhook Event
 * @param {string} text - ข้อความที่ต้องการตอบกลับ
 * @param {string} token - LINE Channel Access Token
 */
async function lineReply(replyToken, text, token) {
  if (!token || !replyToken) return;
  try {
    const r = await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] }),
    });
    
    // อัปเกรด: หาก LINE ตอบกลับมาว่าส่งไม่ผ่าน (เช่น Token หมดอายุ) จะพ่น Log บอกสาเหตุทันทีค๊าาา
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      console.error('lineReply failed', r.status, 'Token:', replyToken.slice(0, 10) + '...', body.slice(0, 300));
    }
  } catch (err) {
    console.error('lineReply error', err.message);
  }
}

module.exports = { todayBKK, formatMoney, linePush, lineReply };
