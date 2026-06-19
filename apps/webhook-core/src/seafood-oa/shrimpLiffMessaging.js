const { liffOpenUrl } = require('./provisionShrimpLiff');

function getShrimpLiffId() {
  return String(process.env.LINE_LIFF_ID || '').trim();
}

function buildLiffOrderFlex(liffId) {
  const uri = liffOpenUrl(liffId);
  return {
    type: 'flex',
    altText: 'เปิดฟอร์มสั่งกุ้ง',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          {
            type: 'text',
            text: '🦐 สั่งกุ้งโกอ้วน',
            weight: 'bold',
            size: 'lg',
            color: '#0f172a',
          },
          {
            type: 'text',
            text: 'เลือกไซซ์ · น้ำหนัก · วันส่ง\nหรือเลือกชื่อร้านจากรายชื่อ',
            size: 'sm',
            color: '#64748b',
            wrap: true,
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#0284c7',
            action: {
              type: 'uri',
              label: 'เปิดฟอร์มสั่ง',
              uri,
            },
          },
        ],
      },
    },
  };
}

function replyLiffNotReadyText(lang) {
  const key = lang === 'en' ? 'en' : lang === 'my' ? 'my' : 'th';
  const M = {
    th: '⚠️ ฟอร์มสั่งยังตั้งค่าไม่ครบ — พิมพ์สั่งแบบเดิมได้ (เช่น ปุ้ย กลาง 6 กก) หรือแจ้งร้านครับ',
    my: '⚠️ ဖောင် မပြင်ရသေး — စာသားနဲ့ အော်ဒါ ပို့ပါ',
    en: '⚠️ Order form not ready yet — you can still type your order (e.g. Peach 6 kg m).',
  };
  return M[key];
}

function buildLiffWelcomeFlex(liffId) {
  const flex = buildLiffOrderFlex(liffId);
  return [
    {
      type: 'text',
      text: 'สวัสดีครับ 🦐 โกอ้วน คลังซีฟู้ด\nกดปุ่มด้านล่างสั่งผ่านฟอร์ม หรือพิมพ์สั่งในแชทได้เลย',
    },
    flex,
  ];
}

async function lineReplyMessages(replyToken, messages, token) {
  if (!token || !replyToken || !messages?.length) return;
  try {
    await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ replyToken, messages }),
    });
  } catch {
    /* best-effort */
  }
}

module.exports = {
  getShrimpLiffId,
  buildLiffOrderFlex,
  buildLiffWelcomeFlex,
  replyLiffNotReadyText,
  lineReplyMessages,
};
