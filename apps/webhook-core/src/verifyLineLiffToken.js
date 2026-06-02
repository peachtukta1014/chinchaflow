/**
 * ตรวจ LINE LIFF id_token — https://developers.line.biz/en/reference/line-login/#verify-id-token
 * client_id ต้องเป็น Channel ID (ตัวเลข) ไม่ใช่ LIFF ID ทั้งก้อน (เช่น 2010271574 ไม่ใช่ 2010271574-xxx)
 */
function resolveIdTokenClientId() {
  const explicit = String(process.env.LINE_LOGIN_CHANNEL_ID || '').trim();
  if (explicit) return explicit;

  const liffId = String(process.env.LINE_LIFF_ID || '').trim();
  const fromLiff = liffId.match(/^(\d+)-/);
  if (fromLiff) return fromLiff[1];

  return liffId;
}

async function verifyLineLiffIdToken(idToken) {
  const token = String(idToken || '').trim();
  const clientId = resolveIdTokenClientId();
  if (!token) {
    const err = new Error('missing_id_token');
    err.code = 'missing_id_token';
    throw err;
  }
  if (!clientId) {
    const err = new Error('liff_not_configured');
    err.code = 'liff_not_configured';
    throw err;
  }

  const body = new URLSearchParams();
  body.set('id_token', token);
  body.set('client_id', clientId);

  const res = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.error_description || 'invalid_id_token');
    err.code = 'invalid_id_token';
    throw err;
  }

  return {
    lineUserId: json.sub || '',
    name: json.name || '',
    picture: json.picture || '',
  };
}

module.exports = { verifyLineLiffIdToken, resolveIdTokenClientId };
