// ── AI Chat API — เรียกผ่าน Cloud Function (ไม่เรียก OpenRouter โดยตรง) ─────
// หน้าที่: ป้องกัน API Key รั่วไหล, จัดการ system prompt ที่ backend โดยตัดระบบ scope ออก

export const CHAT_FUNCTION_URL = import.meta.env.VITE_AI_CHAT_FUNCTION_URL
  || 'https://asia-southeast1-chincha-eeed6.cloudfunctions.net/aiChatAgentHttp';

/**
 * ดึงผลลัพธ์สุดท้ายจาก Firestore (ใช้เมื่อ client กลับมา foreground)
 * @param {string} requestId - ไอดีอ้างอิงชุดคำสั่งเพื่อดึงข้อมูลข้าม session ค้างเดิม
 * @returns {Promise<{reply: string}|null>} คืนค่าเฉพาะข้อความตอบกลับที่แมตช์สำเร็จ
 */
export async function fetchResult(requestId) {
  try {
    const res = await fetch(`${CHAT_FUNCTION_URL}?action=result&requestId=${encodeURIComponent(requestId)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.found ? { reply: data.reply } : null;
  } catch (err) {
    console.error('fetchResult recovery error:', err);
    return null;
  }
}

/**
 * ดึงสถานะ progress ของ request ที่กำลังรัน
 * @param {string} requestId - ไอดีอ้างอิงสเตตัสการทำงานปัจจุบันของ Agent Backend
 * @returns {Promise<{step: string|null, ts: number|null}>}
 */
export async function pollProgress(requestId) {
  try {
    const res = await fetch(`${CHAT_FUNCTION_URL}?action=progress&requestId=${encodeURIComponent(requestId)}`);
    if (!res.ok) return { step: null, ts: null };
    return await res.json();
  } catch (err) {
    console.error('pollProgress network error:', err);
    return { step: null, ts: null };
  }
}

/**
 * ดึงสถานะ deploy ล่าสุดของทุก app จาก Firestore ผ่าน Cloud Function
 * @returns {Promise<Record<string,{status:string,updatedAt:string|null}>|null>}
 */
export async function fetchDeployStatus() {
  try {
    const res = await fetch(`${CHAT_FUNCTION_URL}?action=deploy_status`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error('fetchDeployStatus communication error:', err);
    return null;
  }
}

/**
 * ส่งข้อความ (+ รูปภาพถ้ามี) ไปให้ AI แล้วรับคำตอบกลับโดยตรงแบบ Decoupled Scope
 * @param {object} opts
 * @param {string} opts.message       - ข้อความคำสั่งหรือข้อความแนบเนื้อหาไฟล์ดิบจากผู้ใช้
 * @param {Array}  opts.history       - [{role, content}] ประวัติแชทย้อนหลังสูงสุด 10 ลำดับล่าสุด
 * @param {string} [opts.requestId]   - Unique UUID สำหรับผูกสเตตัส Polling และระบบ Recovery Backstage
 * @param {Array}  [opts.images]      - อาร์เรย์ของสตริง Base64 ของรูปภาพเพื่อประมวลผล Multi-modal
 * @param {string} [opts.imageBase64] - Fallback บัฟเฟอร์สตริงรูปภาพเดี่ยว
 * @returns {Promise<{reply: string, intent?: string, status?: string, prUrl?: string, branchName?: string}>}
 */
export async function chatWithAI({ message, history = [], images = null, imageBase64 = null, requestId = null }) {
  try {
    // ปรับโครงสร้างข้อมูล Payload หลักโดยนำฟิลด์ scope ออกทั้งหมดเพื่อผลักภาระการคำนวณบริบทไปไว้ที่ Backend 
    const body = { message, history };
    
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
        reply: err?.reply || err?.error || `เชื่อมต่อ AI Server ไม่ได้ชั่วคราว (${res.status}) — ลองส่งใหม่นะคะ 🙏`,
      };
    }

    const data = await res.json();
    
    // ส่งคืนเฉพาะออบเจกต์ผลลัพธ์และโครงสร้างทางวิศวกรรมการทำงาน (Git/CI/CD Execution) 
    return {
      reply: data.reply || 'ไม่ได้รับคำตอบจาก AI',
      intent: data.intent || 'chat',
      status: data.status,
      prUrl: data.prUrl,
      branchName: data.branchName,
    };
  } catch (err) {
    console.error('chatWithAI fetch network breakdown:', err);
    return {
      reply: 'ไม่สามารถเชื่อมต่อกับ AI Server — เช็คอินเทอร์เน็ตหรือลองใหม่ภายหลัง',
    };
  }
}
