// ── AI Chat API — เรียกผ่าน Cloud Function (ไม่เรียก OpenRouter โดยตรง) ─────
// หน้าที่: ป้องกัน API Key รั่วไหล, จัดการ system prompt + scope ที่ backend

const FUNCTION_URL = import.meta.env.VITE_AI_CHAT_FUNCTION_URL
  || 'https://asia-southeast1-chincha-eeed6.cloudfunctions.net/aiChatAgentHttp';

/**
 * ส่งข้อความไปให้ AI แล้วรับคำตอบกลับ
 * @param {object} opts
 * @param {string} opts.message - ข้อความผู้ใช้
 * @param {Array}  opts.history - [{role, content}] ประวัติแชท
 * @param {string} opts.scope   - 'root'|'tea'|'seafood'|'webhook'|'scheduled'
 * @returns {Promise<{reply: string, scope: string}>}
 */
export async function chatWithAI({ message, history = [], scope = 'root' }) {
  try {
    const res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history, scope }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        reply: `❌ Error (${res.status}): ${err?.error || 'ไม่สามารถติดต่อ AI Server ได้'}`,
        scope,
      };
    }

    const data = await res.json();
    return {
      reply: data.reply || '⚠️ ไม่ได้รับคำตอบจาก AI',
      scope: data.scope || scope,
    };
  } catch (err) {
    console.error('chatWithAI fetch error:', err);
    return {
      reply: '❌ ไม่สามารถเชื่อมต่อกับ AI Server — เช็คอินเทอร์เน็ตหรือลองใหม่ภายหลัง',
      scope,
    };
  }
}