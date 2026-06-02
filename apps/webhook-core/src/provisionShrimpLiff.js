/**
 * สร้าง/อัปเดต LIFF app บน channel กุ้ง (Messaging API token)
 * ใช้ใน CI ก่อน build/deploy — LIFF ID ไม่ใช่ secret (ฝังใน client ได้)
 */

const DEFAULT_ENDPOINT = 'https://ko-seafood.top/liff-order.html';

async function lineFetch(url, token, options = {}) {
  const r = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await r.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!r.ok) {
    const err = new Error(json.message || json.error || `LINE API ${r.status}`);
    err.status = r.status;
    err.body = json;
    throw err;
  }
  return json;
}

function normalizeEndpoint(url) {
  return String(url || DEFAULT_ENDPOINT).trim().replace(/\/$/, '');
}

function appMatchesEndpoint(app, endpoint) {
  const viewUrl = app?.view?.url || '';
  return normalizeEndpoint(viewUrl) === normalizeEndpoint(endpoint);
}

/**
 * @returns {Promise<string>} liffId
 */
async function ensureShrimpLiffApp({
  token,
  endpoint = DEFAULT_ENDPOINT,
  description = 'สั่งกุ้ง · โกอ้วน คลังซีฟู้ด',
} = {}) {
  const accessToken = String(token || process.env.LINE_CHANNEL_ACCESS_TOKEN || '').trim();
  if (!accessToken) {
    const err = new Error('missing LINE_CHANNEL_ACCESS_TOKEN');
    err.code = 'missing_token';
    throw err;
  }

  const target = normalizeEndpoint(endpoint);
  const list = await lineFetch('https://api.line.me/liff/v1/apps', accessToken);
  const apps = list.apps || [];

  const existing = apps.find((a) => appMatchesEndpoint(a, target));
  if (existing?.liffId) {
    return existing.liffId;
  }

  const created = await lineFetch('https://api.line.me/liff/v1/apps', accessToken, {
    method: 'POST',
    body: JSON.stringify({
      view: { type: 'full', url: target },
      description,
    }),
  });

  if (!created.liffId) {
    throw new Error('LINE did not return liffId');
  }
  return created.liffId;
}

function liffOpenUrl(liffId) {
  return `https://liff.line.me/${String(liffId).trim()}`;
}

module.exports = {
  DEFAULT_ENDPOINT,
  ensureShrimpLiffApp,
  liffOpenUrl,
  normalizeEndpoint,
};
