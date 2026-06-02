/**
 * ตรวจ LINE LIFF id_token — https://developers.line.biz/en/docs/liff/development/
 * ใช้ LINE_LIFF_ID (ตัวเลข LIFF app) เป็น client_id
 */
async function verifyLineLiffIdToken(idToken) {
  const token = String(idToken || '').trim();
  const clientId = String(process.env.LINE_LIFF_ID || '').trim();
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

module.exports = { verifyLineLiffIdToken };
