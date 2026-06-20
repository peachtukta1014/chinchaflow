// ── AI Chat API — เรียกผ่าน Cloud Function (ไม่เรียก OpenRouter โดยตรง) ─────
// หน้าที่: ป้องกัน API Key รั่วไหล, จัดการ system prompt + scope ที่ backend

export const CHAT_FUNCTION_URL = import.meta.env.VITE_AI_CHAT_FUNCTION_URL
  || 'https://asia-southeast1-chincha-eeed6.cloudfunctions.net/aiChatAgentHttp';

/**
 * ดึงสถานะ progress ของ request ที่กำลังรัน
 * @param {string} requestId
 * @returns {Promise<{step: string|null, ts: number|null}>}
 */
export async function pollProgress(requestId) {
  try {
    const res = await fetch(`${CHAT_FUNCTION_URL}?action=progress&requestId=${encodeURIComponent(requestId)}`);
    if (!res.ok) return { step: null, ts: null };
    return await res.json();
  } catch {
    return { step: null, ts: null };
  }
}

/**
 * ส่งข้อความ (+ รูปภาพถ้ามี) ไปให้ AI แล้วรับคำตอบกลับ
 * @param {object} opts
 * @param {string} opts.message     - ข้อความผู้ใช้
 * @param {Array}  opts.history     - [{role, content}] ประวัติแชท
 * @param {string} opts.scope       - 'root'|'tea'|'seafood'|'webhook'|'scheduled'
 * @param {string} [opts.requestId] - ID สำหรับ poll progress
 * @param {string} [opts.imageBase64] - base64 string (ไม่รวม data: prefix)
 * @returns {Promise<{reply: string, scope: string, intent?: string, status?: string, prUrl?: string, branchName?: string}>}
 */
export async function chatWithAI({ message, history = [], scope = 'root', images = null, imageBase64 = null, requestId = null }) {
  try {
    const body = { message, history, scope };
    if (requestId) body.requestId = requestId;
    if (images && images.length > 0) {
      body.images = images;
    } else if (imageBase64) {
      body.imageBase64 = imageBase64;
    }
    const res = await fetch(CHAT_FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        reply: `Error (${res.status}): ${err?.error || 'ไม่สามารถติดต่อ AI Server ได้'}`,
        scope,
      };
    }

    const data = await res.json();
    return {
      reply: data.reply || 'ไม่ได้รับคำตอบจาก AI',
      scope: data.scope || scope,
      intent: data.intent || 'chat',
      status: data.status,
      prUrl: data.prUrl,
      branchName: data.branchName,
    };
  } catch (err) {
    console.error('chatWithAI fetch error:', err);
    return {
      reply: 'ไม่สามารถเชื่อมต่อกับ AI Server — เช็คอินเทอร์เน็ตหรือลองใหม่ภายหลัง',
      scope,
    };
  }
}