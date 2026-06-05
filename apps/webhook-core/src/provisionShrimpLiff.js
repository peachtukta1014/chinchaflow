/**
 * สร้าง/อัปเดต LIFF app บน channel กุ้ง (Messaging API token)
 * ใช้ใน CI ก่อน build/deploy — LIFF ID ไม่ใช่ secret (ฝังใน client ได้)
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_ENDPOINT = 'https://ko-seafood.top/liff-order.html';
const SLIP_LIFF_JSON = path.join(__dirname, '../shrimp-liff-slip-id.json');
const SLIP_DEFAULT_ENDPOINT = 'https://ko-seafood.top/liff-slip.html';

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

function readSlipLiffIdFromRepo() {
  try {
    if (!fs.existsSync(SLIP_LIFF_JSON)) return '';
    const data = JSON.parse(fs.readFileSync(SLIP_LIFF_JSON, 'utf8'));
    return String(data.liffId || '').trim();
  } catch {
    return '';
  }
}

function resolveShrimpSlipLiffId() {
  return String(
    process.env.LINE_LIFF_SLIP_ID
    || process.env.VITE_LIFF_SLIP_ID
    || readSlipLiffIdFromRepo()
    || '',
  ).trim();
}

/** URL เปิด LIFF ฝากสลิป — ใส่ในข้อความบิลค้าง / help */
function getShrimpSlipLiffOpenUrl(billNo) {
  const id = resolveShrimpSlipLiffId();
  if (!id) return '';
  const base = liffOpenUrl(id);
  const bill = String(billNo || '').trim();
  if (!bill) return base;
  return `${base}?billNo=${encodeURIComponent(bill)}`;
}

module.exports = {
  DEFAULT_ENDPOINT,
  SLIP_DEFAULT_ENDPOINT,
  SLIP_LIFF_JSON,
  ensureShrimpLiffApp,
  liffOpenUrl,
  normalizeEndpoint,
  readSlipLiffIdFromRepo,
  resolveShrimpSlipLiffId,
  getShrimpSlipLiffOpenUrl,
};
