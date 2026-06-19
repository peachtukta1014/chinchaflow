/** ยูทิลิตี้ LINE Messaging API ที่ใช้ร่วมกันทุก scope */

function todayBKK() {
  return new Date(Date.now() + 7 * 3600000).toISOString().split('T')[0];
}

function formatMoney(n) {
  return `฿${Math.round(n || 0).toLocaleString('th-TH')}`;
}

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

async function lineReply(replyToken, text, token) {
  if (!token || !replyToken) return;
  try {
    await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] }),
    });
  } catch { /* best-effort */ }
}

module.exports = { todayBKK, formatMoney, linePush, lineReply };
