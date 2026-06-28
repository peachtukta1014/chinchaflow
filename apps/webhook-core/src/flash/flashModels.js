// OpenRouter model constants and caller for Flash (จีจี้)
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const FLASH_MODEL  = 'deepseek/deepseek-v4-flash';
const PRO_MODEL    = 'deepseek/deepseek-v4-pro';
const VISION_MODEL = 'openai/gpt-4o-mini';
const SEARCH_MODEL = 'deepseek/deepseek-chat'; // web plugin ใช้ได้กับ deepseek-chat

function pickModel(userText, { imageBase64, images } = {}) {
  if (imageBase64 || (images && images.length > 0)) return process.env.VISION_MODEL || VISION_MODEL;
  return process.env.CHAT_MODEL || FLASH_MODEL;
}

// รองรับ vision เมื่อมี imageBase64 หรือ images[]
// แก้: userText (แทน text) เพื่อป้องกัน const text ซ้ำชื่อกัน
async function callOpenRouter(apiKey, messages, { imageBase64, images, userText } = {}) {
  const model = pickModel(userText || '', { imageBase64, images });

  let finalMessages = messages;
  const hasImages = imageBase64 || (images && images.length > 0);
  if (hasImages) {
    const imageItems = [];
    if (imageBase64) {
      imageItems.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } });
    }
    if (images && images.length > 0) {
      images.forEach(b64 => imageItems.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } }));
    }
    finalMessages = messages.map((m, idx) => {
      if (idx === messages.length - 1 && m.role === 'user') {
        return {
          ...m,
          content: [
            { type: 'text', text: typeof m.content === 'string' ? m.content : '' },
            ...imageItems,
          ],
        };
      }
      return m;
    });
  }

  const isProModel = model.includes('pro') || model.includes('v4-pro');
  const isVisionModel = model.includes('gpt-4o') || model.includes('vision');
  const maxTokens = isProModel ? 8192 : isVisionModel ? 1024 : 2048;
  const temperature = isProModel ? 0.15 : 0.3;

  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://chincha-flow.web.app',
      'X-Title': 'CHINCHA FLOW AI Admin',
    },
    body: JSON.stringify({
      model,
      messages: finalMessages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`OpenRouter ${res.status}: ${err?.error?.message || 'Unknown'}`);
  }

  let data;
  try {
    data = await res.json();
  } catch (parseErr) {
    throw new Error(`OpenRouter ตอบกลับมาไม่สมบูรณ์: ${parseErr.message}`);
  }
  const raw = data?.choices?.[0]?.message?.content || '⚠️ ไม่ได้รับคำตอบจาก AI';
  const text = raw.replace(/<\s*\/?\s*\|\s*DSML\s*\|[^>]*>/g, '').replace(/\n{3,}/g, '\n\n').trim() || '⚠️ ไม่ได้รับคำตอบจาก AI';
  const usage = data?.usage || {};
  const responseModel = data?.model || model;
  return {
    text,
    usage: {
      input: usage.prompt_tokens || 0,
      output: usage.completion_tokens || 0,
      model: responseModel,
    },
  };
}

// ค้นเว็บผ่าน OpenRouter web plugin — ใช้ deepseek-chat (รองรับ plugin)
// model ตัดสินใจเองว่าจะค้นเว็บหรือไม่ — ไม่ได้บังคับค้นทุกครั้ง
async function callOpenRouterForWebSearch(apiKey, query) {
  const model = process.env.SEARCH_MODEL || SEARCH_MODEL;
  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://chincha-flow.web.app',
      'X-Title': 'CHINCHA FLOW Web Research',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: query }],
      temperature: 0.1,
      max_tokens: 1500,
      plugins: [{ id: 'web', max_results: 3 }],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`OpenRouter WebSearch ${res.status}: ${err?.error?.message || 'Unknown'}`);
  }
  const data = await res.json().catch(() => null);
  if (!data) throw new Error('OpenRouter WebSearch: parse error');
  const text = data?.choices?.[0]?.message?.content || '';
  const usage = data?.usage || {};
  return {
    text,
    usage: { input: usage.prompt_tokens || 0, output: usage.completion_tokens || 0, model: data?.model || model },
  };
}

module.exports = { OPENROUTER_BASE, FLASH_MODEL, PRO_MODEL, VISION_MODEL, SEARCH_MODEL, pickModel, callOpenRouter, callOpenRouterForWebSearch };
